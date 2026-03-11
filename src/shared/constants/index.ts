// Game balance constants
export const GAME_CONSTANTS = {
  MIN_ROOMS: 1,
  MAX_ROOMS: 5,
  MIN_DURATION_MINUTES: 15,
  MAX_DURATION_MINUTES: 60,
  DEFAULT_HINTS_AVAILABLE: 8,
  HINT_TIME_PENALTY_SECONDS: 30,
  STATE_SYNC_INTERVAL_MS: 5000,
  TIMER_TICK_MS: 1000,
  MAX_CHAT_MESSAGE_LENGTH: 500,
  GENERATION_TIMEOUT_MS: 120000,
  ASSET_GENERATION_TIMEOUT_MS: 60000,
} as const;

// Theme definitions with display info
export const THEMES = [
  { id: "abandoned_library", name: "Abandoned Library", description: "Dusty shelves, hidden passages, and forgotten knowledge.", icon: "📚" },
  { id: "science_laboratory", name: "Science Laboratory", description: "Bubbling chemicals, strange equipment, and dangerous experiments.", icon: "🧪" },
  { id: "corporate_office", name: "Corporate Office", description: "After-hours secrets hidden behind the corporate facade.", icon: "🏢" },
  { id: "dungeon_castle", name: "Castle Dungeon", description: "Ancient stone walls, rusted chains, and medieval mysteries.", icon: "🏰" },
  { id: "spaceship_scifi", name: "Space Station", description: "A derelict station drifting in silence. What happened to the crew?", icon: "🚀" },
  { id: "hotel_noir", name: "Hotel Noir", description: "A seedy hotel room. Someone left in a hurry.", icon: "🏨" },
  { id: "basement_industrial", name: "Industrial Basement", description: "Pipes, machinery, and something that shouldn't be here.", icon: "🏭" },
  { id: "museum_gallery", name: "Museum After Dark", description: "Priceless art, laser grids, and a heist gone wrong.", icon: "🎨" },
  { id: "cabin_woods", name: "Cabin in the Woods", description: "Remote, isolated, and full of someone's obsessive research.", icon: "🏕️" },
  { id: "doctor_office", name: "Doctor's Office", description: "A small-town practice hiding unauthorized experiments.", icon: "🏥" },
] as const;

export const DIFFICULTY_SETTINGS = {
  easy: {
    label: "Easy",
    description: "Single-step puzzles, generous hints, no red herrings.",
    puzzleCount: { min: 4, max: 6 },
    redHerringCount: 0,
    hintPolicy: "free" as const,
    narrativeGuidance: "heavy" as const,
  },
  medium: {
    label: "Medium",
    description: "Multi-step reasoning, limited hints, some misdirection.",
    puzzleCount: { min: 6, max: 8 },
    redHerringCount: 3,
    hintPolicy: "limited" as const,
    narrativeGuidance: "moderate" as const,
  },
  hard: {
    label: "Hard",
    description: "Complex deduction, scarce hints, meaningful red herrings.",
    puzzleCount: { min: 8, max: 10 },
    redHerringCount: 5,
    hintPolicy: "time_penalty" as const,
    narrativeGuidance: "minimal" as const,
  },
} as const;

export const DURATION_OPTIONS = [
  { minutes: 15, rooms: 1, label: "Quick — 15 min" },
  { minutes: 30, rooms: 2, label: "Standard — 30 min" },
  { minutes: 45, rooms: 3, label: "Extended — 45 min" },
  { minutes: 60, rooms: 4, label: "Marathon — 60 min" },
] as const;
