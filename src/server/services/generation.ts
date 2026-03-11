import Anthropic from "@anthropic-ai/sdk";
import type { EscapeRoomSession, SessionConfig } from "@shared/types";
import { ROOM_GENERATION_SYSTEM_PROMPT, buildGenerationPrompt } from "@shared/prompts";
import { GAME_CONSTANTS } from "@shared/constants";

let _client: Anthropic;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface GenerationCallbacks {
  onProgress: (message: string) => void;
  onError: (error: string) => void;
}

/**
 * Calls Opus to generate a complete escape room session.
 * Streams the response to handle long generation times.
 */
export async function generateEscapeRoom(
  config: SessionConfig,
  themeDescription: string | undefined,
  callbacks: GenerationCallbacks
): Promise<EscapeRoomSession> {
  callbacks.onProgress("Initializing Opus generation...");

  const userPrompt = buildGenerationPrompt(config, themeDescription);

  callbacks.onProgress("Generating escape room with Opus — this may take 30-60 seconds...");

  let fullText = "";

  try {
    const stream = await getClient().messages.stream({
      model: "claude-opus-4-20250514",
      max_tokens: 16000,
      system: ROOM_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    let tokenCount = 0;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        tokenCount++;
        // Send progress updates every ~500 tokens
        if (tokenCount % 500 === 0) {
          callbacks.onProgress(`Generating... (~${Math.round(tokenCount * 4)} characters so far)`);
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    callbacks.onProgress(
      `Generation complete. ${finalMessage.usage.input_tokens} input / ${finalMessage.usage.output_tokens} output tokens.`
    );
  } catch (error: any) {
    const message = error?.message || "Unknown generation error";
    callbacks.onError(`Opus generation failed: ${message}`);
    throw new Error(`Generation failed: ${message}`);
  }

  // Parse JSON
  callbacks.onProgress("Parsing generated room data...");

  let jsonText = fullText.trim();
  // Strip markdown fences if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let session: EscapeRoomSession;
  try {
    // Opus outputs snake_case (matching the prompt schema), we store it as-is
    // and normalize to camelCase when needed by the client
    session = JSON.parse(jsonText);
  } catch (parseError: any) {
    // Attempt JSON repair before failing
    callbacks.onProgress("JSON parse failed, attempting repair...");
    const repaired = attemptJsonRepair(jsonText);
    if (repaired) {
      try {
        session = JSON.parse(repaired);
        callbacks.onProgress("JSON repair successful!");
      } catch {
        callbacks.onError(`Failed to parse generated JSON even after repair: ${parseError.message}`);
        throw new Error(`JSON parse error: ${parseError.message}. First 200 chars: ${jsonText.substring(0, 200)}`);
      }
    } else {
      callbacks.onError(`Failed to parse generated JSON: ${parseError.message}`);
      throw new Error(`JSON parse error: ${parseError.message}. First 200 chars: ${jsonText.substring(0, 200)}`);
    }
  }

  // Auto-repair common issues before validation
  callbacks.onProgress("Checking and repairing room structure...");
  repairSession(session);

  // Validate critical structure
  callbacks.onProgress("Validating room structure...");
  const errors = validateSession(session);
  if (errors.length > 0) {
    callbacks.onProgress(`Warning: ${errors.length} validation issues found: ${errors.join("; ")}`);
    // Don't throw — let the game attempt to run with warnings
  }

  callbacks.onProgress("Room generation complete!");
  return session;
}

/**
 * Auto-repair common structural issues in generated sessions.
 * Mutates the session object in place.
 */
function repairSession(session: any): void {
  const puzzles: any[] = session.puzzles || [];
  const puzzleIds = new Set(puzzles.map((p: any) => p.puzzle_id || p.puzzleId));
  const objectIds = new Set((session.objects || []).map((o: any) => o.object_id || o.objectId));
  const graph = session.dependency_graph || session.dependencyGraph;

  // Remove requires entries that reference non-existent puzzles
  for (const puzzle of puzzles) {
    if (puzzle.requires) {
      puzzle.requires = puzzle.requires.filter((r: string) => puzzleIds.has(r));
    }
    // Remove requires_objects entries that reference non-existent objects
    if (puzzle.requires_objects) {
      puzzle.requires_objects = puzzle.requires_objects.filter((r: string) => objectIds.has(r));
    }
    if (puzzle.requiresObjects) {
      puzzle.requiresObjects = puzzle.requiresObjects.filter((r: string) => objectIds.has(r));
    }
  }

  // Ensure entry_puzzles reference valid puzzles
  if (graph) {
    const entryKey = graph.entry_puzzles ? "entry_puzzles" : "entryPuzzles";
    if (graph[entryKey]) {
      graph[entryKey] = graph[entryKey].filter((id: string) => puzzleIds.has(id));
    }

    // If entry_puzzles is empty after filtering, add all puzzles with no requires
    if (!graph[entryKey]?.length) {
      graph[entryKey] = puzzles
        .filter((p: any) => !(p.requires?.length))
        .map((p: any) => p.puzzle_id || p.puzzleId);
    }

    // Ensure final_puzzle is valid
    const finalKey = graph.final_puzzle !== undefined ? "final_puzzle" : "finalPuzzle";
    if (graph[finalKey] && !puzzleIds.has(graph[finalKey])) {
      // Pick the puzzle with the most requirements as final
      let maxReqs = -1;
      let bestPid = "";
      for (const p of puzzles) {
        const reqs = (p.requires || []).length;
        if (reqs > maxReqs) {
          maxReqs = reqs;
          bestPid = p.puzzle_id || p.puzzleId;
        }
      }
      graph[finalKey] = bestPid;
    }
  }

  // Ensure all objects have valid categories
  for (const obj of (session.objects || [])) {
    const validCategories = ["key_item", "clue", "tool", "combination_result", "red_herring", "environmental"];
    if (!validCategories.includes(obj.category)) {
      obj.category = "environmental"; // safe default
    }
  }

  // Ensure all puzzles have a valid config.type matching puzzle.type
  for (const puzzle of puzzles) {
    const config = puzzle.config || {};
    if (!config.type && puzzle.type) {
      config.type = puzzle.type;
      puzzle.config = config;
    }
  }
}

/**
 * Validates the generated session for structural integrity.
 * Returns an array of error messages (empty = valid).
 */
function validateSession(session: any): string[] {
  const errors: string[] = [];

  if (!session.session_id && !session.sessionId) errors.push("Missing session_id");
  if (!session.rooms?.length) errors.push("No rooms generated");
  if (!session.puzzles?.length) errors.push("No puzzles generated");
  if (!session.objects?.length) errors.push("No objects generated");
  if (!session.dependency_graph && !session.dependencyGraph) errors.push("Missing dependency_graph");

  const graph = session.dependency_graph || session.dependencyGraph;
  if (graph) {
    if (!graph.entry_puzzles?.length && !graph.entryPuzzles?.length) {
      errors.push("No entry puzzles in dependency graph");
    }
    const entryPuzzles = graph.entry_puzzles || graph.entryPuzzles || [];
    if (entryPuzzles.length < 2) {
      errors.push(`Only ${entryPuzzles.length} entry puzzle(s) — need at least 2`);
    }
    if (!graph.final_puzzle && !graph.finalPuzzle) {
      errors.push("No final puzzle defined");
    }
  }

  // Check puzzle IDs are valid
  const puzzleIds = new Set((session.puzzles || []).map((p: any) => p.puzzle_id || p.puzzleId));
  const objectIds = new Set((session.objects || []).map((o: any) => o.object_id || o.objectId));

  for (const puzzle of session.puzzles || []) {
    const pid = puzzle.puzzle_id || puzzle.puzzleId;
    const requires = puzzle.requires || [];
    for (const req of requires) {
      if (!puzzleIds.has(req)) {
        errors.push(`Puzzle ${pid} requires non-existent puzzle ${req}`);
      }
    }
    const reqObjects = puzzle.requires_objects || puzzle.requiresObjects || [];
    for (const req of reqObjects) {
      if (!objectIds.has(req)) {
        errors.push(`Puzzle ${pid} requires non-existent object ${req}`);
      }
    }

    // Check hints
    const hints = puzzle.hints || [];
    if (hints.length !== 3) {
      errors.push(`Puzzle ${pid} has ${hints.length} hints (need 3)`);
    }
  }

  // Check co-op percentage
  const puzzles = session.puzzles || [];
  const coopCount = puzzles.filter((p: any) => p.coop?.mode !== "solo").length;
  const coopPct = puzzles.length > 0 ? coopCount / puzzles.length : 0;
  if (coopPct < 0.25) {
    errors.push(`Only ${Math.round(coopPct * 100)}% co-op puzzles (target: 30%+)`);
  }

  // SOLVABILITY CHECK: verify every puzzle is reachable from entry puzzles
  if (graph && puzzles.length > 0) {
    const entryPuzzles: string[] = graph.entry_puzzles || graph.entryPuzzles || [];
    const finalPuzzle = graph.final_puzzle || graph.finalPuzzle;

    // Build reachability: simulate solving from entry puzzles
    const solved = new Set<string>();
    const available = new Set<string>(entryPuzzles);

    // Iteratively solve all available puzzles until no more can be solved
    let changed = true;
    while (changed) {
      changed = false;
      for (const pid of available) {
        if (solved.has(pid)) continue;
        solved.add(pid);
        available.delete(pid);
        changed = true;

        // Check which puzzles this unlocks
        for (const p of puzzles) {
          const tid = p.puzzle_id || p.puzzleId;
          if (solved.has(tid) || available.has(tid)) continue;
          const reqs: string[] = p.requires || [];
          // A puzzle with no requires that isn't an entry puzzle is orphaned
          if (reqs.length === 0 && !entryPuzzles.includes(tid)) {
            // Treat as available (entry puzzle without being listed)
            available.add(tid);
            changed = true;
            continue;
          }
          if (reqs.length > 0 && reqs.every((r: string) => solved.has(r))) {
            available.add(tid);
            changed = true;
          }
        }
      }
    }

    // Check for unreachable puzzles
    for (const p of puzzles) {
      const pid = p.puzzle_id || p.puzzleId;
      if (!solved.has(pid)) {
        const reqs: string[] = p.requires || [];
        const unmet = reqs.filter((r: string) => !solved.has(r));
        errors.push(`Puzzle "${p.name}" (${pid}) is unreachable — unmet deps: ${unmet.join(", ") || "none (orphaned)"}`);
      }
    }

    // Check final puzzle is reachable
    if (finalPuzzle && !solved.has(finalPuzzle)) {
      errors.push(`Final puzzle ${finalPuzzle} is NOT reachable from entry puzzles — game is unsolvable!`);
    }

    // Check puzzle configs have solutions
    for (const p of puzzles) {
      const pid = p.puzzle_id || p.puzzleId;
      const config = p.config || {};
      const type = config.type || p.type;
      if (type === "combination_lock" && !config.solution) {
        errors.push(`Puzzle ${pid} (combination_lock) has no solution defined`);
      }
      if (type === "cipher" && !config.solution) {
        errors.push(`Puzzle ${pid} (cipher) has no solution defined`);
      }
      if (type === "pattern" && !config.answer && !config.solution) {
        errors.push(`Puzzle ${pid} (pattern) has no answer/solution defined`);
      }
      if (type === "sequence" && !(config.correct_order || config.correctOrder)) {
        errors.push(`Puzzle ${pid} (sequence) has no correct_order defined`);
      }
    }
  }

  // Check that objects in zone.contains actually exist
  const rooms = session.rooms || [];
  for (const room of rooms) {
    for (const zone of (room.zones || [])) {
      const zoneId = zone.zone_id || zone.zoneId;
      for (const oid of (zone.contains || [])) {
        if (!objectIds.has(oid)) {
          errors.push(`Zone ${zoneId} references non-existent object ${oid}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Attempt to repair common JSON issues from Opus output:
 * - Trailing commas
 * - Unclosed braces/brackets
 * - Missing closing quotes
 */
function attemptJsonRepair(text: string): string | null {
  let repaired = text;

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  // Count open/close braces and brackets
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of repaired) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  // Close any unclosed braces/brackets
  while (brackets > 0) {
    repaired += "]";
    brackets--;
  }
  while (braces > 0) {
    repaired += "}";
    braces--;
  }

  // Verify the repair worked
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}
