import { nanoid } from "nanoid";
import type {
  EscapeRoomSession, GameState, PlayerState, PlayerId,
  SessionConfig, PuzzleRewards, GameStatus,
} from "@shared/types";
import { GAME_CONSTANTS } from "@shared/constants";

/** How long to keep a session alive after all players disconnect (ms) */
const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface CompletedAsset {
  type: "background" | "sprite" | "texture";
  id: string;
  url: string;
}

export interface PendingCoopConfirm {
  puzzleId: string;
  fromPlayer: PlayerId;
  answer: unknown;
  timestamp: number;
}

export interface ActiveSession {
  id: string;
  config: SessionConfig;
  escapeRoom: EscapeRoomSession | null;
  gameState: GameState;
  timerInterval: ReturnType<typeof setInterval> | null;
  createdAt: number;
  socketMap: Map<string, PlayerId>; // socket.id -> player role
  completedAssets: Map<string, CompletedAsset>;
  /** Reconnection tokens per player slot */
  reconnectTokens: Map<PlayerId, string>;
  /** Pending sequential_confirm answers awaiting P2 confirmation */
  pendingCoopConfirms: Map<string, PendingCoopConfirm>; // puzzleId -> pending
  /** Cleanup timeout handle (for delayed deletion after disconnect) */
  cleanupTimeout: ReturnType<typeof setTimeout> | null;
}

class GameSessionStore {
  private sessions = new Map<string, ActiveSession>();

  create(config: SessionConfig, playerName: string): ActiveSession {
    const id = nanoid(8);

    const initialState: GameState = {
      sessionId: id,
      status: "lobby",
      elapsedSeconds: 0,
      timeLimitSeconds: config.targetDurationMinutes * 60,
      players: [
        {
          playerId: "player_1",
          displayName: playerName,
          connected: true,
          currentRoom: "",
          inventory: [],
          currentView: "room",
          zoomTarget: null,
          activePuzzle: null,
        },
        {
          playerId: "player_2",
          displayName: "",
          connected: false,
          currentRoom: "",
          inventory: [],
          currentView: "room",
          zoomTarget: null,
          activePuzzle: null,
        },
      ],
      puzzlesSolved: [],
      puzzlesAvailable: [],
      objectsDiscovered: [],
      objectsInWorld: [],
      zoneStates: {},
      transitionsUnlocked: [],
      storyBeatsRevealed: [],
      hintsUsed: 0,
      hintsRemaining: GAME_CONSTANTS.DEFAULT_HINTS_AVAILABLE,
    };

    const session: ActiveSession = {
      id,
      config,
      escapeRoom: null,
      gameState: initialState,
      timerInterval: null,
      createdAt: Date.now(),
      socketMap: new Map(),
      completedAssets: new Map(),
      reconnectTokens: new Map([
        ["player_1", nanoid(16)],
        ["player_2", nanoid(16)],
      ]),
      pendingCoopConfirms: new Map(),
      cleanupTimeout: null,
    };

    this.sessions.set(id, session);
    return session;
  }

  get(id: string): ActiveSession | undefined {
    return this.sessions.get(id);
  }

  listJoinable(): { id: string; theme: string; difficulty: string; playerCount: number }[] {
    const results: { id: string; theme: string; difficulty: string; playerCount: number }[] = [];
    for (const [id, session] of this.sessions) {
      if (session.gameState.status === "lobby") {
        const connected = session.gameState.players.filter(p => p.connected).length;
        if (connected < 2) {
          results.push({
            id,
            theme: session.config.theme,
            difficulty: session.config.difficulty,
            playerCount: connected,
          });
        }
      }
    }
    return results;
  }

  /**
   * Initialize game state from generated escape room data.
   * Sets up initial zone states, available objects, and entry puzzles.
   */
  initializeFromGeneration(sessionId: string, escapeRoom: EscapeRoomSession): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.escapeRoom = escapeRoom;

    // Normalize — Opus outputs snake_case, we need to handle both
    const rooms: any[] = escapeRoom.rooms || [];
    const objects: any[] = escapeRoom.objects || [];
    const puzzles: any[] = escapeRoom.puzzles || [];
    const graph = (escapeRoom as any).dependency_graph || escapeRoom.dependencyGraph;

    // Set initial room for both players
    const firstRoomId = rooms[0]?.room_id || rooms[0]?.roomId || "";
    session.gameState.players[0].currentRoom = firstRoomId;
    session.gameState.players[1].currentRoom = firstRoomId;

    // Initialize zone states
    const zoneStates: Record<string, string> = {};
    for (const room of rooms) {
      for (const zone of (room.zones || [])) {
        const zoneId = zone.zone_id || zone.zoneId;
        const defaultState = zone.default_state || zone.defaultState;
        if (zoneId && defaultState) {
          zoneStates[zoneId] = defaultState;
        }
      }
    }
    session.gameState.zoneStates = zoneStates;

    // Find initially visible objects
    const visibleObjects: string[] = [];
    const worldObjects: string[] = [];
    for (const obj of objects) {
      const objId = obj.object_id || obj.objectId;
      const location = obj.location;
      const visible = location?.initially_visible ?? location?.initiallyVisible ?? true;
      if (visible && (location?.type === "zone")) {
        visibleObjects.push(objId);
        worldObjects.push(objId);
      }
    }
    session.gameState.objectsDiscovered = visibleObjects;
    session.gameState.objectsInWorld = worldObjects;

    // Set entry puzzles as available
    const entryPuzzles = graph?.entry_puzzles || graph?.entryPuzzles || [];
    session.gameState.puzzlesAvailable = [...entryPuzzles];

    // Set hints based on difficulty
    const modifiers = (escapeRoom as any).difficulty_modifiers || escapeRoom.difficultyModifiers;
    if (modifiers) {
      session.gameState.hintsRemaining = modifiers.hints_available ?? modifiers.hintsAvailable ?? GAME_CONSTANTS.DEFAULT_HINTS_AVAILABLE;
    }
  }

  /**
   * Start (or resume) the game timer.
   */
  startTimer(sessionId: string, onTick: (elapsed: number, remaining: number) => void, resetTime = true): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear any existing interval to prevent stacking
    if (session.timerInterval) clearInterval(session.timerInterval);

    session.gameState.status = "playing";
    if (resetTime) {
      session.gameState.elapsedSeconds = 0;
    }

    session.timerInterval = setInterval(() => {
      session.gameState.elapsedSeconds++;
      const remaining = session.gameState.timeLimitSeconds - session.gameState.elapsedSeconds;
      onTick(session.gameState.elapsedSeconds, remaining);

      if (remaining <= 0) {
        session.gameState.status = "failed";
        if (session.timerInterval) clearInterval(session.timerInterval);
      }
    }, GAME_CONSTANTS.TIMER_TICK_MS);
  }

  /**
   * Process a puzzle solve and update game state.
   */
  solvePuzzle(sessionId: string, puzzleId: string): PuzzleRewards | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.escapeRoom) return null;

    const puzzles: any[] = session.escapeRoom.puzzles || [];
    const puzzle = puzzles.find((p: any) => (p.puzzle_id || p.puzzleId) === puzzleId);
    if (!puzzle) return null;

    const pid = (puzzle as any).puzzle_id || puzzle.puzzleId;

    // Already solved?
    if (session.gameState.puzzlesSolved.includes(pid)) return null;

    // Mark solved
    session.gameState.puzzlesSolved.push(pid);
    session.gameState.puzzlesAvailable = session.gameState.puzzlesAvailable.filter(id => id !== pid);

    // Process rewards
    const rewards = puzzle.rewards || {};
    const granted = rewards.objects_granted || rewards.objectsGranted || [];
    const revealed = rewards.objects_revealed || rewards.objectsRevealed || [];
    const zonesChanged = rewards.zones_changed || rewards.zonesChanged || [];
    const transitionsUnlocked = rewards.transitions_unlocked || rewards.transitionsUnlocked || [];
    const narrativeBeat = rewards.narrative_beat || rewards.narrativeBeat;

    // Add granted objects to the world (they'll be picked up by the handler)
    for (const objId of granted) {
      if (!session.gameState.objectsDiscovered.includes(objId)) {
        session.gameState.objectsDiscovered.push(objId);
      }
    }

    // Add revealed objects to world
    for (const objId of revealed) {
      if (!session.gameState.objectsInWorld.includes(objId)) {
        session.gameState.objectsInWorld.push(objId);
        session.gameState.objectsDiscovered.push(objId);
      }
    }

    // Update zone states
    for (const change of zonesChanged) {
      const zoneId = change.zone_id || change.zoneId;
      const newState = change.new_state || change.newState;
      if (zoneId && newState) {
        session.gameState.zoneStates[zoneId] = newState;
      }
    }

    // Unlock transitions
    for (const roomId of transitionsUnlocked) {
      if (!session.gameState.transitionsUnlocked.includes(roomId)) {
        session.gameState.transitionsUnlocked.push(roomId);
      }
    }

    // Reveal story beat
    if (narrativeBeat && !session.gameState.storyBeatsRevealed.includes(narrativeBeat)) {
      session.gameState.storyBeatsRevealed.push(narrativeBeat);
    }

    // Unlock newly available puzzles — check ALL puzzles whose requirements are now met
    // This handles convergence points where multiple prerequisites must all be solved
    for (const p of puzzles) {
      const tid = (p as any).puzzle_id || p.puzzleId;
      if (session.gameState.puzzlesSolved.includes(tid)) continue;
      if (session.gameState.puzzlesAvailable.includes(tid)) continue;
      const reqs = p.requires || [];
      if (reqs.length > 0 && reqs.every((r: string) => session.gameState.puzzlesSolved.includes(r))) {
        session.gameState.puzzlesAvailable.push(tid);
      }
    }

    // Check if this was the final puzzle
    const graph = (session.escapeRoom as any).dependency_graph || (session.escapeRoom as any).dependencyGraph;
    const finalPuzzle = graph?.final_puzzle || graph?.finalPuzzle;
    if (pid === finalPuzzle) {
      session.gameState.status = "completed";
      if (session.timerInterval) clearInterval(session.timerInterval);
    }

    return {
      objectsGranted: granted,
      objectsRevealed: revealed,
      zonesChanged,
      transitionsUnlocked,
      narrativeBeat: narrativeBeat || null,
    };
  }

  /** Validate a reconnection token */
  validateReconnect(sessionId: string, playerId: PlayerId, token: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    return session.reconnectTokens.get(playerId) === token;
  }

  /** Get the reconnect token for a player slot */
  getReconnectToken(sessionId: string, playerId: PlayerId): string | undefined {
    return this.sessions.get(sessionId)?.reconnectTokens.get(playerId);
  }

  /** Schedule session cleanup (called on disconnect, cancelled on rejoin) */
  scheduleCleanup(sessionId: string, onCleanup: () => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    // Cancel any existing cleanup
    if (session.cleanupTimeout) clearTimeout(session.cleanupTimeout);
    session.cleanupTimeout = setTimeout(() => {
      const s = this.sessions.get(sessionId);
      if (s && s.gameState.players.every(p => !p.connected)) {
        onCleanup();
        this.delete(sessionId);
      }
    }, RECONNECT_WINDOW_MS);
  }

  /** Cancel pending cleanup (called on rejoin) */
  cancelCleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.cleanupTimeout) {
      clearTimeout(session.cleanupTimeout);
      session.cleanupTimeout = null;
    }
  }

  delete(id: string): void {
    const session = this.sessions.get(id);
    if (session?.timerInterval) clearInterval(session.timerInterval);
    if (session?.cleanupTimeout) clearTimeout(session.cleanupTimeout);
    this.sessions.delete(id);
  }
}

// Singleton
export const gameSessionStore = new GameSessionStore();
