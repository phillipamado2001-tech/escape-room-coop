import type { SessionConfig } from "../types";
import { DIFFICULTY_SETTINGS } from "../constants";

// ============================================================
// OPUS GENERATION SYSTEM PROMPT
// ============================================================

export const ROOM_GENERATION_SYSTEM_PROMPT = `You are an expert escape room designer. Generate a complete cooperative escape room as a single valid JSON object.

DESIGN PRINCIPLES:
1. FAIR PUZZLES: Every solution must be discoverable from clues IN the room. No outside knowledge. Players should be able to explain their reasoning after solving.
2. NO PIXEL HUNTING: Every interactable zone has visual or narrative reasons to attract attention. Clues point players where to look.
3. BRANCHING CONVERGENCE: Minimum 2 entry puzzles available from start. Parallel threads converge at mid-tier puzzles. Final puzzle requires convergence of all threads.
4. COOPERATIVE: 30%+ puzzles require genuine co-op with SPECIFIC screen-by-screen descriptions of what each player sees.
5. NARRATIVE DRIVEN: Each solved puzzle reveals story. The premise establishes who, where, why. The conclusion is a satisfying payoff.
6. GROUNDED LOGIC: Puzzle solutions should feel logical in retrospect. No adventure-game nonsense.
7. CLUE CHAIN INTEGRITY: If a lock solution is "4019", objects in the room must contain discoverable information that leads to 4019. Trace every chain.

CO-OP MODES (describe EXACTLY what each player's screen shows):
- asymmetric_info: P1 sees info A, P2 sees info B. They must verbally share to solve.
- complementary_view: P1's perspective reveals element X, P2's reveals element Y.
- parallel_thread: Separate puzzle branches per player, results combine at convergence.
- sequential_confirm: P1 acts, P2 sees validation data and confirms.
- NEVER require simultaneous real-time actions. All co-op is information-based.

PUZZLE TYPES AND WHEN TO USE EACH:
- combination_lock: A physical numbered padlock or safe dial. Solution MUST be purely numeric (e.g., "4019"). Config needs: digits, solution (string of digits), lock_style. ONLY use this when the puzzle is literally "enter a number code."
- cipher: Encrypted text the player must decode. Config needs: method, encrypted_text, solution, key_location.
- pattern: "What comes next?" puzzles with a sequence of elements (words, symbols, numbers, images). The answer is typed as text. Config needs: pattern_elements (array of displayed items), answer (string — the next element), solution_logic (explanation). Use this for ANY puzzle where the player must identify a pattern and predict the next item, even if the answer happens to be a number.
- sequence: Arrange items in the correct order by clicking. Config needs: elements (array), correct_order (array).
- observation: Solved by noticing something in the environment. No typed answer needed.
- inventory_use: Solved by using the right object on a zone. No typed answer needed.
- symbol_match: Match symbols to meanings. Config needs: pairs, correct_mapping.
- drag_arrange: Arrange elements spatially. Config needs: elements, correct_mapping.
- wiring: Connect nodes correctly. Config needs: nodes, correct_connections.
- jigsaw: NOT IMPLEMENTED — DO NOT USE.
- logic_grid: NOT IMPLEMENTED — DO NOT USE.
- slider: NOT IMPLEMENTED — DO NOT USE.

PREFERRED puzzle types (use these for 90%+ of puzzles): combination_lock, cipher, pattern, sequence, observation, inventory_use. Use symbol_match, drag_arrange, wiring sparingly.

IMPORTANT: config.type MUST exactly match the puzzle's "type" field. If the puzzle type is "pattern", config.type must also be "pattern".

DIFFICULTY SCALING:
- easy: single-step logic, heavy narrative guidance, no red herrings, free hints
- medium: multi-step reasoning, moderate guidance, 2-3 red herrings, limited hints
- hard: multi-source deduction, minimal guidance, 4-5 red herrings, hint penalties

CRITICAL RULES:
- Every puzzle needs exactly 3 hints (tier 1: vague nudge, tier 2: directional, tier 3: near-explicit but requires one logical step)
- All IDs must be unique snake_case strings
- Dependency graph must be a DAG with no cycles
- combination_lock configs need: digits, solution, lock_style
- cipher configs need: method, encrypted_text, solution, key_location
- inventory_use configs need: required_object_id, target_zone_id, interaction_description, result_description
- Do NOT split a single puzzle into two (e.g., calculating a code then entering the code are ONE puzzle, not two)
- Zone positions use percentage coordinates (0-100)
- Red herrings should be plausible but distinguishable, never blocking
- OBJECT PORTABILITY: Only objects that make physical sense to carry should be key_item, clue, or tool. Things inscribed on walls (scratchings, engravings, murals, plaques, signs), built-in fixtures (pipes, valves, panels), and large furniture should be "environmental". If a clue is written on a wall or engraved into something, make it environmental and put the clue in its inspection.clue_text — players can read it without picking it up. Portable clues are things like notes, letters, photos, cards, books.
- SOLVABILITY: The dependency graph must form a valid path from entry_puzzles to final_puzzle. Every puzzle must be reachable by solving its prerequisites. Every puzzle solution must be derivable from clues available when the puzzle unlocks. Double-check each clue chain before finalizing.
- The JSON must be COMPLETE. Do not truncate. Keep generation_notes to 3-4 sentences.

OUTPUT: Return ONLY valid JSON. No markdown fences. No text outside the JSON object.`;

// ============================================================
// JSON SCHEMA REFERENCE (included in user prompt)
// ============================================================

const JSON_SCHEMA = `{
  "session_id": "string",
  "config": { "theme": "string", "difficulty": "string", "target_duration_minutes": number, "room_count": number, "player_count": 2 },
  "narrative": {
    "premise": "2-3 sentences", "protagonist_context": "who players are",
    "stakes": "consequences of failure",
    "story_beats": [{ "id": "string", "text": "string", "revealed_by": "puzzle_id|null", "order": number }],
    "conclusion": "payoff text"
  },
  "rooms": [{
    "room_id": "string", "name": "string", "background_tags": ["string"],
    "atmosphere": { "lighting": "bright|dim|dark|flickering|colored", "mood": "string", "ambient_description": "string" },
    "zones": [{
      "zone_id": "string", "name": "string",
      "position": { "x": 0-100, "y": 0-100, "width": number, "height": number },
      "visual_description": "string", "default_state": "state_id",
      "states": [{ "state_id": "string", "description": "string", "visual_change": "string|null", "objects_revealed": ["obj_id"], "triggered_by": "puzzle_id|null" }],
      "interactable": boolean, "zoom_view": boolean, "contains": ["obj_id"]
    }],
    "transitions": [{ "to_room_id": "string", "description": "string", "requires": "puzzle_id|null", "position": { "x": num, "y": num, "width": num, "height": num } }],
    "entry_narrative": "string"
  }],
  "objects": [{
    "object_id": "string", "name": "string", "description": "string",
    "category": "key_item|clue|tool|combination_result|red_herring|environmental",
    "asset_tags": ["string"],
    "location": { "type": "zone|hidden|created", "zone_id": "string|null", "initially_visible": boolean, "revealed_by": "puzzle_id|null" },
    "inspection": { "description": "string", "clue_text": "string|null" },
    "combinations": [{ "combine_with": "obj_id", "produces": "obj_id", "description": "string" }],
    "usable_on": [{ "target_zone_id": "string", "effect": "string", "triggers": "puzzle_id" }],
    "player_visibility": "both|player_1|player_2"
  }],
  "puzzles": [{
    "puzzle_id": "string", "name": "string", "type": "puzzle_type", "difficulty_rating": 1-5, "room_id": "string",
    "requires": ["puzzle_id"], "requires_objects": ["obj_id"],
    "coop": { "mode": "solo|asymmetric_info|complementary_view|parallel_thread|sequential_confirm", "player_1_sees": "specific screen content", "player_2_sees": "specific screen content", "collaboration_hint": "string" },
    "config": { "type": "matching_type", ...type_fields },
    "rewards": { "objects_granted": [], "objects_revealed": [], "zones_changed": [{"zone_id":"str","new_state":"str"}], "transitions_unlocked": ["room_id"], "narrative_beat": "beat_id|null" },
    "hints": [{ "tier": 1, "text": "vague" }, { "tier": 2, "text": "directional" }, { "tier": 3, "text": "near-explicit" }],
    "flavor_text": "string", "solve_narrative": "string"
  }],
  "dependency_graph": { "entry_puzzles": ["id","id"], "connections": [{"from":"id","to":"id","type":"unlocks|provides_item|reveals_clue"}], "convergence_points": ["id"], "final_puzzle": "id" },
  "difficulty_modifiers": { "red_herring_count": num, "hint_policy": "free|limited|time_penalty", "hints_available": num, "time_pressure": "relaxed|standard|strict", "time_bonus_seconds": num, "puzzle_complexity": "single_step|multi_step|multi_source", "false_leads": boolean, "narrative_guidance": "heavy|moderate|minimal" },
  "asset_requirements": {
    "backgrounds": [{ "room_id": "str", "prompt_description": "detailed scene for image gen, digital painting style, slightly stylized", "style_tags": [], "aspect_ratio": "16:9" }],
    "sprites": [{ "object_id": "str", "prompt_description": "object on transparent bg, digital painted style", "style_tags": [], "size_category": "small|medium|large" }],
    "puzzle_textures": [{ "puzzle_id": "str", "surface_description": "str", "style_tags": [] }]
  },
  "estimated_solve_time_minutes": number,
  "generation_notes": "brief design reasoning"
}`;

// ============================================================
// USER PROMPT BUILDER
// ============================================================

export function buildGenerationPrompt(config: SessionConfig, themeDescription?: string): string {
  const diff = DIFFICULTY_SETTINGS[config.difficulty];
  const puzzleRange = `${diff.puzzleCount.min}-${diff.puzzleCount.max}`;
  const coopMin = Math.ceil(diff.puzzleCount.min * 0.3);

  return `Generate a complete escape room with these parameters:

Theme: ${config.theme}${themeDescription ? ` — ${themeDescription}` : ""}
Difficulty: ${config.difficulty}
Target Duration: ${config.targetDurationMinutes} minutes
Rooms: ${config.roomCount}
Players: 2 (cooperative)

Requirements:
- ${puzzleRange} puzzles total
- At least ${coopMin} puzzles must be genuinely cooperative with specific per-player screen descriptions
- ${diff.redHerringCount} red herrings
- 10-15 objects
- Hint policy: ${diff.hintPolicy}
- Narrative guidance: ${diff.narrativeGuidance}

JSON Schema to follow:
${JSON_SCHEMA}

IMPORTANT: The complete JSON must fit in output. Keep descriptions concise (1-2 sentences). Keep generation_notes to 3-4 sentences. Keep asset_requirements to backgrounds + key items + tools only.

Return ONLY the JSON. No other text.`;
}

// ============================================================
// HINT GENERATION PROMPT (Sonnet — in-game)
// ============================================================

export const HINT_SYSTEM_PROMPT = `You are a mysterious escape room game master providing hints to stuck players. 

Rules:
- Tier 1: Gentle nudge, no specifics. "Have you examined everything on the desk?"
- Tier 2: Specific direction. "The numbers on the frame seem significant. Compare them to something else."
- Tier 3: Near-explicit, but still requires one logical step. "The frame shows 4-1-8-7. Try the cabinet lock."
- Never state the solution directly.
- Be encouraging and in-character.
- Keep it to 1-2 sentences.`;

export function buildHintPrompt(
  puzzleName: string,
  puzzleType: string,
  flavorText: string,
  config: unknown,
  prewrittenHints: { tier: number; text: string }[],
  puzzlesSolved: string[],
  inventory: string[],
  requestedTier: 1 | 2 | 3
): string {
  return `Players are stuck on: "${puzzleName}" (${puzzleType})
Context: ${flavorText}
Puzzle config: ${JSON.stringify(config)}
Pre-written hint for tier ${requestedTier}: "${prewrittenHints.find(h => h.tier === requestedTier)?.text}"
Puzzles solved: ${puzzlesSolved.join(", ") || "none"}
Inventory: ${inventory.join(", ") || "empty"}

Deliver a tier ${requestedTier} hint. Use the pre-written hint as a base but adapt if the players' progress makes it redundant. Respond with ONLY the hint text.`;
}
