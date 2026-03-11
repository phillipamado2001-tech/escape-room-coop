import Anthropic from "@anthropic-ai/sdk";
import { HINT_SYSTEM_PROMPT, buildHintPrompt } from "@shared/prompts";
import type { Hint } from "@shared/types";

let _client: Anthropic;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * Generates a contextual hint using Sonnet.
 * Uses pre-written hints as a base but adapts to player progress.
 */
export async function generateHint(
  puzzleName: string,
  puzzleType: string,
  flavorText: string,
  config: unknown,
  prewrittenHints: Hint[],
  puzzlesSolved: string[],
  inventory: string[],
  requestedTier: 1 | 2 | 3
): Promise<string> {
  // If we have a pre-written hint and the player hasn't made unusual progress,
  // just return it directly without an API call
  const prewritten = prewrittenHints.find(h => h.tier === requestedTier);
  if (prewritten && puzzlesSolved.length < 3) {
    return prewritten.text;
  }

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: HINT_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: buildHintPrompt(
          puzzleName, puzzleType, flavorText, config,
          prewrittenHints, puzzlesSolved, inventory, requestedTier
        ),
      }],
    });

    const text = response.content.find(b => b.type === "text");
    return text?.text || prewritten?.text || "Look more carefully at your surroundings.";
  } catch {
    // Fallback to pre-written hint if API fails
    return prewritten?.text || "Look more carefully at your surroundings.";
  }
}
