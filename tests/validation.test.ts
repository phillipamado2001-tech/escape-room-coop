import { describe, it, expect } from "vitest";
import { sanitizeText, isValidString, isValidId, RateLimiter } from "@server/lib/validation";

describe("sanitizeText", () => {
  it("escapes HTML entities", () => {
    expect(sanitizeText("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(sanitizeText("a & b")).toBe("a &amp; b");
  });

  it("escapes double quotes", () => {
    expect(sanitizeText('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("passes through safe text unchanged", () => {
    expect(sanitizeText("hello world 123")).toBe("hello world 123");
  });
});

describe("isValidString", () => {
  it("accepts valid strings", () => {
    expect(isValidString("hello")).toBe(true);
    expect(isValidString("a")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(isValidString("")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidString(123)).toBe(false);
    expect(isValidString(null)).toBe(false);
    expect(isValidString(undefined)).toBe(false);
  });

  it("respects max length", () => {
    expect(isValidString("abc", 3)).toBe(true);
    expect(isValidString("abcd", 3)).toBe(false);
  });
});

describe("isValidId", () => {
  it("accepts valid IDs", () => {
    expect(isValidId("puzzle_1")).toBe(true);
    expect(isValidId("room-2")).toBe(true);
    expect(isValidId("abc123")).toBe(true);
  });

  it("rejects IDs with special characters", () => {
    expect(isValidId("a b")).toBe(false);
    expect(isValidId("<script>")).toBe(false);
    expect(isValidId("a/b")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidId("")).toBe(false);
  });

  it("rejects strings over 64 characters", () => {
    expect(isValidId("a".repeat(65))).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("allows actions within limit", () => {
    const limiter = new RateLimiter();
    expect(limiter.isAllowed("test", 1000, 3)).toBe(true);
    expect(limiter.isAllowed("test", 1000, 3)).toBe(true);
    expect(limiter.isAllowed("test", 1000, 3)).toBe(true);
  });

  it("blocks actions over limit", () => {
    const limiter = new RateLimiter();
    limiter.isAllowed("test", 1000, 1);
    expect(limiter.isAllowed("test", 1000, 1)).toBe(false);
  });

  it("separates keys", () => {
    const limiter = new RateLimiter();
    limiter.isAllowed("a", 1000, 1);
    expect(limiter.isAllowed("b", 1000, 1)).toBe(true);
  });
});
