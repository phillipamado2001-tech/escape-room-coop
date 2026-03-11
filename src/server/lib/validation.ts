/**
 * Input validation and rate limiting for socket events.
 */

/** Sanitize text to prevent XSS — strips HTML tags */
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Validate a string is non-empty and within length */
export function isValidString(input: unknown, maxLength = 500): input is string {
  return typeof input === "string" && input.length > 0 && input.length <= maxLength;
}

/** Validate an ID-like string (alphanumeric + underscores + hyphens) */
export function isValidId(input: unknown): input is string {
  return typeof input === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(input);
}

/** Simple rate limiter per action type */
export class RateLimiter {
  private timestamps = new Map<string, number[]>();

  /**
   * Check if action is allowed.
   * @param key - unique key for the action (e.g., "hint:player_1")
   * @param windowMs - time window in milliseconds
   * @param maxActions - max actions allowed in window
   */
  isAllowed(key: string, windowMs: number, maxActions: number): boolean {
    const now = Date.now();
    const stamps = this.timestamps.get(key) ?? [];

    // Remove old timestamps
    const recent = stamps.filter((t) => now - t < windowMs);

    if (recent.length >= maxActions) {
      return false;
    }

    recent.push(now);
    this.timestamps.set(key, recent);
    return true;
  }

  /** Clean up old entries (call periodically) */
  cleanup(maxAgeMs = 60000) {
    const now = Date.now();
    for (const [key, stamps] of this.timestamps) {
      const recent = stamps.filter((t) => now - t < maxAgeMs);
      if (recent.length === 0) {
        this.timestamps.delete(key);
      } else {
        this.timestamps.set(key, recent);
      }
    }
  }
}

/** Rate limit constants */
export const RATE_LIMITS = {
  HINT: { windowMs: 10000, maxActions: 1 },       // 1 hint per 10s
  CHAT: { windowMs: 1000, maxActions: 2 },         // 2 messages per 1s
  PUZZLE_ATTEMPT: { windowMs: 2000, maxActions: 1 }, // 1 attempt per 2s
} as const;
