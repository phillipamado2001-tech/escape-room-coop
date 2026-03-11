// ============================================================
// SHARED TYPES — The contract between generation, engine, and renderer
// ============================================================

// --- Session Configuration (Player Input) ---

export type Theme =
  | "abandoned_library"
  | "science_laboratory"
  | "corporate_office"
  | "dungeon_castle"
  | "spaceship_scifi"
  | "hotel_noir"
  | "basement_industrial"
  | "museum_gallery"
  | "cabin_woods"
  | "medical_hospital"
  | "doctor_office"
  | string;

export type Difficulty = "easy" | "medium" | "hard";

export interface SessionConfig {
  theme: Theme;
  difficulty: Difficulty;
  targetDurationMinutes: number;
  roomCount: number;
  playerCount: 2;
  seed?: string;
}

// --- Narrative ---

export interface StoryBeat {
  id: string;
  text: string;
  revealedBy: string | null;
  order: number;
}

export interface Narrative {
  premise: string;
  protagonistContext: string;
  stakes: string;
  storyBeats: StoryBeat[];
  conclusion: string;
}

// --- Rooms & Zones ---

export interface ZonePosition {
  x: number; // 0-100 percentage
  y: number;
  width: number;
  height: number;
}

export interface ZoneState {
  stateId: string;
  description: string;
  visualChange: string | null;
  objectsRevealed: string[];
  triggeredBy: string | null;
}

export interface Zone {
  zoneId: string;
  name: string;
  position: ZonePosition;
  visualDescription: string;
  defaultState: string;
  states: ZoneState[];
  interactable: boolean;
  zoomView: boolean;
  contains: string[];
}

export interface RoomTransition {
  toRoomId: string;
  description: string;
  requires: string | null;
  position: ZonePosition;
}

export interface Room {
  roomId: string;
  name: string;
  backgroundTags: string[];
  atmosphere: {
    lighting: "bright" | "dim" | "dark" | "flickering" | "colored";
    mood: string;
    ambientDescription: string;
  };
  zones: Zone[];
  transitions: RoomTransition[];
  entryNarrative: string;
}

// --- Objects ---

export type ObjectCategory =
  | "key_item"
  | "clue"
  | "tool"
  | "combination_result"
  | "red_herring"
  | "environmental";

export interface ObjectInspection {
  description: string;
  clueText: string | null;
}

export interface ObjectCombination {
  combineWith: string;
  produces: string;
  description: string;
}

export interface ObjectUsage {
  targetZoneId: string;
  effect: string;
  triggers: string;
}

export interface GameObject {
  objectId: string;
  name: string;
  description: string;
  category: ObjectCategory;
  assetTags: string[];
  location: {
    type: "zone" | "hidden" | "created";
    zoneId: string | null;
    initiallyVisible: boolean;
    revealedBy: string | null;
  };
  inspection: ObjectInspection;
  combinations: ObjectCombination[];
  usableOn: ObjectUsage[];
  playerVisibility: "both" | "player_1" | "player_2";
}

// --- Puzzles ---

export type PuzzleType =
  | "observation"
  | "combination_lock"
  | "cipher"
  | "jigsaw"
  | "sequence"
  | "pattern"
  | "logic_grid"
  | "inventory_use"
  | "drag_arrange"
  | "slider"
  | "wiring"
  | "symbol_match";

export type CoopMode =
  | "solo"
  | "asymmetric_info"
  | "complementary_view"
  | "parallel_thread"
  | "sequential_confirm";

export interface CoopSplit {
  mode: CoopMode;
  player1Sees: string;
  player2Sees: string;
  collaborationHint: string;
}

export interface Hint {
  tier: 1 | 2 | 3;
  text: string;
  timePenaltySeconds?: number;
}

export interface PuzzleRewards {
  objectsGranted: string[];
  objectsRevealed: string[];
  zonesChanged: { zoneId: string; newState: string }[];
  transitionsUnlocked: string[];
  narrativeBeat: string | null;
}

// Puzzle-specific configs
export interface CombinationLockConfig {
  type: "combination_lock";
  digits: number;
  solution: string;
  lockStyle: string;
}

export interface CipherConfig {
  type: "cipher";
  method: string;
  encryptedText: string;
  solution: string;
  keyLocation: string;
}

export interface SequenceConfig {
  type: "sequence";
  elements: string[];
  correctOrder: string[];
  orderLogic: string;
}

export interface PatternConfig {
  type: "pattern";
  patternElements: string[];
  solutionLogic: string;
  answer: string;
}

export interface InventoryUseConfig {
  type: "inventory_use";
  requiredObjectId: string;
  targetZoneId: string;
  interactionDescription: string;
  resultDescription: string;
}

export interface JigsawConfig {
  type: "jigsaw";
  pieces: number;
  imageDescription: string;
  reveals: string;
}

export interface LogicGridConfig {
  type: "logic_grid";
  categories: string[];
  itemsPerCategory: string[][];
  clues: string[];
  solution: Record<string, Record<string, string>>;
}

export interface DragArrangeConfig {
  type: "drag_arrange";
  items: { id: string; label: string; description: string }[];
  targetSlots: { id: string; label: string; position: { x: number; y: number } }[];
  correctMapping: Record<string, string>;
}

export interface WiringConfig {
  type: "wiring";
  nodes: { id: string; label: string; position: { x: number; y: number }; type: "source" | "target" }[];
  correctConnections: [string, string][];
  clueForConnections: string;
}

export interface SymbolMatchConfig {
  type: "symbol_match";
  pairs: { symbolA: string; symbolB: string; description: string }[];
  matchRule: string;
}

export interface ObservationConfig {
  type: "observation";
  targetZoneId: string;
  whatToNotice: string;
  significance: string;
  becomesRelevantAfter?: string;
}

export interface SliderConfig {
  type: "slider";
  gridSize: 3 | 4;
  imageDescription: string;
  reveals: string;
}

export type PuzzleConfig =
  | CombinationLockConfig
  | CipherConfig
  | SequenceConfig
  | PatternConfig
  | InventoryUseConfig
  | JigsawConfig
  | LogicGridConfig
  | DragArrangeConfig
  | WiringConfig
  | SymbolMatchConfig
  | ObservationConfig
  | SliderConfig;

export interface Puzzle {
  puzzleId: string;
  name: string;
  type: PuzzleType;
  difficultyRating: number;
  roomId: string;
  requires: string[];
  requiresObjects: string[];
  coop: CoopSplit;
  config: PuzzleConfig;
  rewards: PuzzleRewards;
  hints: Hint[];
  flavorText: string;
  solveNarrative: string;
}

// --- Dependency Graph ---

export interface DependencyGraph {
  entryPuzzles: string[];
  connections: {
    from: string;
    to: string;
    type: "unlocks" | "provides_item" | "reveals_clue";
  }[];
  convergencePoints: string[];
  finalPuzzle: string;
}

// --- Difficulty Modifiers ---

export interface DifficultyModifiers {
  redHerringCount: number;
  hintPolicy: "free" | "limited" | "time_penalty" | "none";
  hintsAvailable: number;
  timePressure: "relaxed" | "standard" | "strict";
  timeBonusSeconds: number;
  puzzleComplexity: "single_step" | "multi_step" | "multi_source";
  falseLeads: boolean;
  narrativeGuidance: "heavy" | "moderate" | "minimal";
}

// --- Asset Requirements ---

export interface AssetRequirements {
  backgrounds: {
    roomId: string;
    promptDescription: string;
    styleTags: string[];
    aspectRatio: "16:9" | "21:9";
  }[];
  sprites: {
    objectId: string;
    promptDescription: string;
    styleTags: string[];
    sizeCategory: "small" | "medium" | "large";
  }[];
  puzzleTextures: {
    puzzleId: string;
    surfaceDescription: string;
    styleTags: string[];
  }[];
}

// --- Complete Session (Opus Output) ---

export interface EscapeRoomSession {
  sessionId: string;
  config: SessionConfig;
  narrative: Narrative;
  rooms: Room[];
  objects: GameObject[];
  puzzles: Puzzle[];
  dependencyGraph: DependencyGraph;
  difficultyModifiers: DifficultyModifiers;
  assetRequirements: AssetRequirements;
  estimatedSolveTimeMinutes: number;
  generationNotes: string;
}

// --- Runtime Game State ---

export type PlayerId = "player_1" | "player_2";
export type PlayerView = "room" | "zoom" | "puzzle" | "inventory";
export type GameStatus = "lobby" | "generating" | "loading_assets" | "playing" | "paused" | "completed" | "failed";

export interface PlayerState {
  playerId: PlayerId;
  displayName: string;
  connected: boolean;
  currentRoom: string;
  inventory: string[];
  currentView: PlayerView;
  zoomTarget: string | null;
  activePuzzle: string | null;
}

export interface GameState {
  sessionId: string;
  status: GameStatus;
  elapsedSeconds: number;
  timeLimitSeconds: number;
  players: [PlayerState, PlayerState];
  puzzlesSolved: string[];
  puzzlesAvailable: string[];
  objectsDiscovered: string[];
  objectsInWorld: string[];
  zoneStates: Record<string, string>;
  transitionsUnlocked: string[];
  storyBeatsRevealed: string[];
  hintsUsed: number;
  hintsRemaining: number;
}

// --- Socket Events ---

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  sessionData: (session: EscapeRoomSession) => void;
  generationProgress: (message: string) => void;
  generationError: (error: string) => void;
  playerJoined: (player: PlayerState) => void;
  playerLeft: (playerId: PlayerId) => void;
  objectPickedUp: (data: { playerId: PlayerId; objectId: string }) => void;
  objectInspected: (data: { playerId: PlayerId; objectId: string; inspection: ObjectInspection }) => void;
  objectsCombined: (data: { playerId: PlayerId; objectA: string; objectB: string; result: string; description: string }) => void;
  objectUsed: (data: { playerId: PlayerId; objectId: string; target: string; effect: string }) => void;
  puzzleAttempted: (data: { playerId: PlayerId; puzzleId: string; correct: boolean }) => void;
  puzzleSolved: (data: { playerId: PlayerId; puzzleId: string; narrative: string; rewards: PuzzleRewards }) => void;
  hintDelivered: (data: { puzzleId: string; hint: Hint }) => void;
  zoneStateChanged: (data: { zoneId: string; newState: string }) => void;
  transitionUnlocked: (data: { roomId: string }) => void;
  storyBeatRevealed: (data: { beatId: string; text: string }) => void;
  coopConfirmRequested: (data: { playerId: PlayerId; puzzleId: string; action: string; answer: unknown }) => void;
  coopConfirmAccepted: (data: { playerId: PlayerId; puzzleId: string }) => void;
  coopConfirmRejected: (data: { playerId: PlayerId; puzzleId: string }) => void;
  chatMessage: (data: { playerId: PlayerId; message: string; timestamp: number }) => void;
  timerUpdate: (data: { elapsed: number; remaining: number }) => void;
  gameCompleted: (data: { totalTime: number; hintsUsed: number }) => void;
  gameFailed: (data: { reason: string }) => void;
  assetReady: (data: { type: "background" | "sprite" | "texture"; id: string; url: string }) => void;
  objectOffered: (data: { fromPlayer: PlayerId; objectId: string; objectName: string }) => void;
  objectTraded: (data: { fromPlayer: PlayerId; toPlayer: PlayerId; objectId: string }) => void;
  rejoinSuccess: (data: { playerId: PlayerId; sessionId: string; token: string }) => void;
  rejoinFailed: (data: { reason: string }) => void;
}

export interface ClientToServerEvents {
  createRoom: (config: SessionConfig & { playerName: string }) => void;
  joinRoom: (data: { sessionId: string; playerName: string }) => void;
  rejoinSession: (data: { sessionId: string; playerId: PlayerId; token: string }) => void;
  startGame: () => void;
  moveToRoom: (roomId: string) => void;
  zoomInto: (zoneId: string) => void;
  zoomOut: () => void;
  pickUpObject: (objectId: string) => void;
  inspectObject: (objectId: string) => void;
  combineObjects: (objectA: string, objectB: string) => void;
  useObject: (objectId: string, targetZoneId: string) => void;
  attemptPuzzle: (puzzleId: string, answer: unknown) => void;
  requestHint: (puzzleId: string) => void;
  coopConfirm: (puzzleId: string) => void;
  coopReject: (puzzleId: string) => void;
  sendChat: (message: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  offerObject: (objectId: string) => void;
  acceptObject: (objectId: string, fromPlayerId: PlayerId) => void;
}
