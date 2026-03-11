import { create } from "zustand";
import type {
  EscapeRoomSession, GameState, PlayerId, PlayerView,
  ObjectInspection, Hint, PuzzleRewards,
} from "@shared/types";

interface ChatMessage {
  playerId: PlayerId;
  message: string;
  timestamp: number;
}

interface Notification {
  id: string;
  type: "solve" | "hint" | "story" | "error" | "info";
  title: string;
  text: string;
  timestamp: number;
}

interface PuzzleResult {
  puzzleId: string;
  correct: boolean;
  timestamp: number;
}

interface PendingCoopConfirm {
  puzzleId: string;
  fromPlayer: string;
  action: string;
  answer: unknown;
}

interface GameStore {
  // Connection
  connected: boolean;
  playerId: PlayerId | null;
  sessionId: string | null;

  // Data
  escapeRoom: EscapeRoomSession | null;
  gameState: GameState | null;

  // UI state
  generationProgress: string | null;
  generationError: string | null;
  inspectionModal: { objectId: string; inspection: ObjectInspection } | null;
  narrativeModal: { title: string; text: string } | null;
  chatMessages: ChatMessage[];
  notifications: Notification[];
  activeHint: { puzzleId: string; hint: Hint } | null;
  lastPuzzleResult: PuzzleResult | null;
  soundMuted: boolean;
  pendingCoopConfirm: PendingCoopConfirm | null;
  reconnectToken: string | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setPlayerId: (id: PlayerId) => void;
  setSessionId: (id: string) => void;
  setEscapeRoom: (data: EscapeRoomSession) => void;
  setGameState: (state: GameState) => void;
  setGenerationProgress: (msg: string | null) => void;
  setGenerationError: (err: string | null) => void;
  showInspection: (objectId: string, inspection: ObjectInspection) => void;
  hideInspection: () => void;
  showNarrative: (title: string, text: string) => void;
  hideNarrative: () => void;
  addChatMessage: (msg: ChatMessage) => void;
  addNotification: (type: Notification["type"], title: string, text: string) => void;
  dismissNotification: (id: string) => void;
  showHint: (puzzleId: string, hint: Hint) => void;
  hideHint: () => void;
  setPuzzleResult: (result: PuzzleResult | null) => void;
  toggleMute: () => void;
  setCoopConfirm: (confirm: PendingCoopConfirm | null) => void;
  setReconnectToken: (token: string | null) => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  playerId: null as PlayerId | null,
  sessionId: null as string | null,
  escapeRoom: null as EscapeRoomSession | null,
  gameState: null as GameState | null,
  generationProgress: null as string | null,
  generationError: null as string | null,
  inspectionModal: null as GameStore["inspectionModal"],
  narrativeModal: null as GameStore["narrativeModal"],
  chatMessages: [] as ChatMessage[],
  notifications: [] as Notification[],
  activeHint: null as GameStore["activeHint"],
  lastPuzzleResult: null as PuzzleResult | null,
  soundMuted: false,
  pendingCoopConfirm: null as PendingCoopConfirm | null,
  reconnectToken: null as string | null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  setPlayerId: (playerId) => set({ playerId }),
  setSessionId: (sessionId) => set({ sessionId }),
  setEscapeRoom: (escapeRoom) => set({ escapeRoom }),
  setGameState: (gameState) => set({ gameState }),
  setGenerationProgress: (generationProgress) => set({ generationProgress }),
  setGenerationError: (generationError) => set({ generationError }),

  showInspection: (objectId, inspection) => set({ inspectionModal: { objectId, inspection } }),
  hideInspection: () => set({ inspectionModal: null }),

  showNarrative: (title, text) => set({ narrativeModal: { title, text } }),
  hideNarrative: () => set({ narrativeModal: null }),

  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages.slice(-100), msg],
  })),

  addNotification: (type, title, text) => set((state) => ({
    notifications: [
      ...state.notifications,
      { id: `${Date.now()}-${Math.random()}`, type, title, text, timestamp: Date.now() },
    ].slice(-10),
  })),

  dismissNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id),
  })),

  showHint: (puzzleId, hint) => set({ activeHint: { puzzleId, hint } }),
  hideHint: () => set({ activeHint: null }),

  setPuzzleResult: (lastPuzzleResult) => set({ lastPuzzleResult }),
  toggleMute: () => set((state) => ({ soundMuted: !state.soundMuted })),
  setCoopConfirm: (pendingCoopConfirm) => set({ pendingCoopConfirm }),
  setReconnectToken: (reconnectToken) => set({ reconnectToken }),

  reset: () => set(initialState),
}));
