import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock nanoid before importing session-store
vi.mock("nanoid", () => ({
  nanoid: (len?: number) => "test1234",
}));

// Import after mock
const { gameSessionStore } = await import("@server/services/session-store");

describe("GameSessionStore", () => {
  const baseConfig = {
    theme: "abandoned_library" as const,
    difficulty: "medium" as const,
    targetDurationMinutes: 30,
    roomCount: 2,
    playerCount: 2 as const,
  };

  afterEach(() => {
    // Clean up sessions
    const session = gameSessionStore.get("test1234");
    if (session) gameSessionStore.delete("test1234");
  });

  it("creates a session with correct initial state", () => {
    const session = gameSessionStore.create(baseConfig, "Alice");
    expect(session.id).toBe("test1234");
    expect(session.gameState.status).toBe("lobby");
    expect(session.gameState.players[0].displayName).toBe("Alice");
    expect(session.gameState.players[0].connected).toBe(true);
    expect(session.gameState.players[1].connected).toBe(false);
    expect(session.gameState.timeLimitSeconds).toBe(1800);
  });

  it("generates reconnection tokens for both players", () => {
    const session = gameSessionStore.create(baseConfig, "Alice");
    const p1Token = gameSessionStore.getReconnectToken(session.id, "player_1");
    const p2Token = gameSessionStore.getReconnectToken(session.id, "player_2");
    expect(p1Token).toBeTruthy();
    expect(p2Token).toBeTruthy();
  });

  it("validates correct reconnection token", () => {
    const session = gameSessionStore.create(baseConfig, "Alice");
    const token = gameSessionStore.getReconnectToken(session.id, "player_1")!;
    expect(gameSessionStore.validateReconnect(session.id, "player_1", token)).toBe(true);
  });

  it("rejects invalid reconnection token", () => {
    const session = gameSessionStore.create(baseConfig, "Alice");
    expect(gameSessionStore.validateReconnect(session.id, "player_1", "wrong-token")).toBe(false);
  });

  it("rejects reconnect to nonexistent session", () => {
    expect(gameSessionStore.validateReconnect("no-such-id", "player_1", "any-token")).toBe(false);
  });

  it("lists joinable sessions", () => {
    const session = gameSessionStore.create(baseConfig, "Alice");
    const joinable = gameSessionStore.listJoinable();
    expect(joinable).toHaveLength(1);
    expect(joinable[0].id).toBe(session.id);
    expect(joinable[0].playerCount).toBe(1);
  });

  it("solves a puzzle and processes rewards", () => {
    const session = gameSessionStore.create(baseConfig, "Alice");
    // Manually set up escape room data
    session.escapeRoom = {
      sessionId: session.id,
      config: baseConfig,
      narrative: { premise: "", protagonistContext: "", stakes: "", storyBeats: [], conclusion: "" },
      rooms: [],
      objects: [],
      puzzles: [
        {
          puzzleId: "p1",
          name: "Test Puzzle",
          type: "cipher",
          difficultyRating: 1,
          roomId: "r1",
          requires: [],
          requiresObjects: [],
          coop: { mode: "solo", player1Sees: "", player2Sees: "", collaborationHint: "" },
          config: { type: "cipher", method: "none", encryptedText: "test", solution: "answer", keyLocation: "" },
          rewards: { objectsGranted: [], objectsRevealed: ["obj1"], zonesChanged: [], transitionsUnlocked: [], narrativeBeat: null },
          hints: [],
          flavorText: "",
          solveNarrative: "",
        },
      ],
      dependencyGraph: { entryPuzzles: ["p1"], connections: [], convergencePoints: [], finalPuzzle: "p1" },
      difficultyModifiers: { redHerringCount: 0, hintPolicy: "free", hintsAvailable: 8, timePressure: "standard", timeBonusSeconds: 0, puzzleComplexity: "single_step", falseLeads: false, narrativeGuidance: "moderate" },
      assetRequirements: { backgrounds: [], sprites: [], puzzleTextures: [] },
      estimatedSolveTimeMinutes: 15,
      generationNotes: "",
    } as any;
    session.gameState.puzzlesAvailable = ["p1"];
    session.gameState.objectsInWorld = [];

    const rewards = gameSessionStore.solvePuzzle(session.id, "p1");
    expect(rewards).not.toBeNull();
    expect(rewards!.objectsRevealed).toEqual(["obj1"]);
    expect(session.gameState.puzzlesSolved).toContain("p1");
    expect(session.gameState.objectsInWorld).toContain("obj1");
    // Final puzzle solved → game completed
    expect(session.gameState.status).toBe("completed");
  });

  it("deletes session and clears timer", () => {
    const session = gameSessionStore.create(baseConfig, "Alice");
    gameSessionStore.delete(session.id);
    expect(gameSessionStore.get(session.id)).toBeUndefined();
  });
});
