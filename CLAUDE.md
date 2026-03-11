# Escape Room Co-op

AI-generated cooperative escape rooms for 2 players. Opus generates the rooms, Sonnet handles in-game hints, DALL-E 3 generates visual assets (or pre-built Midjourney library).

## Architecture

**Monorepo**: Next.js frontend + Express/Socket.io backend in one project.

```
escape-room-coop/
├── app/                    # Next.js app directory (pages)
├── src/
│   ├── shared/             # Shared between client and server
│   │   ├── types/          # TypeScript interfaces (the schema contract)
│   │   ├── prompts/        # Opus/Sonnet prompt definitions
│   │   └── constants/      # Game balance, themes, difficulty settings
│   ├── server/             # Express + Socket.io backend
│   │   ├── index.ts        # Server entry point (port 3001)
│   │   ├── routes/         # REST API routes
│   │   ├── socket/         # Socket.io event handlers (game loop)
│   │   └── services/       # Generation (Opus), hints (Sonnet), session store
│   └── client/             # React client code
│       ├── components/     # UI components (room renderer, puzzle UIs, HUD)
│       ├── hooks/          # useSocket (socket.io client), custom hooks
│       ├── store/          # Zustand game state store
│       └── styles/         # Tailwind + custom CSS
```

## Key Design Decisions

- **Opus for room generation**: Full escape room (rooms, puzzles, objects, narrative, dependency graph) generated as structured JSON. ~$1 per session.
- **Sonnet for in-game hints**: Lighter model for progressive hint delivery. Falls back to pre-written hints if API fails.
- **Snake_case from Opus**: The generation prompt outputs snake_case JSON (matching the prompt schema). Server handles both snake_case and camelCase throughout.
- **Branching convergence puzzles**: Min 2 entry puzzles, parallel threads, convergence points, single final puzzle. Both players always have something to do.
- **Co-op modes**: asymmetric_info (split information), complementary_view (different scene elements), parallel_thread (separate branches), sequential_confirm (act + validate). NO simultaneous real-time actions.
- **Generic asset interface**: Assets come from either DALL-E API or pre-built library. Engine uses tags to match, doesn't care about source.

## Running

```bash
npm install
cp .env.example .env.local  # Add your ANTHROPIC_API_KEY
npm run dev                  # Starts both client (3000) and server (3001)
```

## What's Built

- [x] Complete TypeScript schema (shared/types)
- [x] Opus generation prompt (shared/prompts) — validated with test generation
- [x] Sonnet hint prompt (shared/prompts)
- [x] Express + Socket.io server with full event handling
- [x] Session store with game state management, puzzle solving, reward processing
- [x] Socket handlers for all game actions (move, zoom, pick up, inspect, combine, use, attempt, hint, chat)
- [x] Zustand client store
- [x] Socket.io client hook with all event bindings
- [x] Next.js app with lobby UI (create room, join room, theme/difficulty/duration selection)
- [x] Tailwind config with dark theme palette

## What's Built (continued)

### Core Game Loop (Priority 1) ✅
- [x] Lobby UI wired to socket actions (createRoom, joinRoom, startGame)
- [x] Room renderer with DALL-E backgrounds and interactive zone overlays
- [x] Zone interaction — click to zoom, see objects, interact
- [x] 6 puzzle UI components (combination lock, cipher, sequence, pattern, matching, wiring) + observation + inventory_use + generic fallback
- [x] Inventory bar with combine, use-on-zone, inspect
- [x] Timer and HUD overlay with partner presence

### Visual Layer (Priority 2) ✅
- [x] DALL-E integration service for background/sprite generation
- [x] Asset caching layer (generate once, store locally)
- [x] CSS filter system for sprite-to-background blending
- [x] Zoom view renderer (close-up of zones)

### Game Feel & Polish ✅
- [x] Sound effects (Web Audio API synthesized: correct/wrong/hint/timer/victory/failure/pickup/chat)
- [x] Mute button in HUD with localStorage persistence
- [x] Puzzle feedback animations (shake on wrong, green flash on correct, loading spinner)
- [x] Full Victory screen with confetti, stats, rating, narrative conclusion, Play Again
- [x] Full Failure screen with unsolved count, flavor text, Try Again
- [x] Narrative typewriter effect with skip button
- [x] Partner presence indicator in HUD (room, zone, puzzle status)
- [x] Partner solve pulse animation
- [x] Object trading (offer/accept between players)

### Robustness & Quality ✅
- [x] Input validation (string length, ID format) on all socket events
- [x] Rate limiting (hints: 1/10s, chat: 2/1s, puzzle attempts: 1/2s)
- [x] XSS prevention via server-side HTML entity sanitization
- [x] JSON repair for Opus generation (trailing commas, unclosed braces)
- [x] React error boundary (app/error.tsx)

### Accessibility & Keyboard ✅
- [x] Escape key closes modals and puzzles
- [x] Arrow keys navigate combination lock digits
- [x] Direct digit typing on combination lock
- [x] Enter submits puzzle answers
- [x] Focus-visible outlines on interactive elements
- [x] Focus trapping in modals
- [x] aria-labels on interactive elements
- [x] Role attributes on timer, spinbuttons, dialogs

### Co-op ✅
- [x] Per-player co-op content displayed in puzzle UI (player1Sees/player2Sees)
- [x] Collaboration hints shown per puzzle
- [x] Object trading (offer/accept) between players
- [x] Co-op confirm event handling
- [x] Sequential confirm flow (P1 submits → P2 confirms/rejects → server validates)
- [x] Co-op enforcement: sequential_confirm puzzles hold P1's answer, P2 sees confirm/reject UI
- [x] Co-op reject (P2 can reject P1's answer with feedback)
- [x] Puzzle components hidden during co-op confirm flow (both awaiting and confirming sides)

### Reconnection ✅
- [x] Reconnection tokens generated per player slot (nanoid 16)
- [x] Session data saved to sessionStorage (sessionId + playerId + token)
- [x] Auto-reconnect on socket connect (reads sessionStorage)
- [x] Server rejoinSession handler validates token, restores socket mapping
- [x] Full state replay on rejoin (escapeRoom, assets, gameState)
- [x] 5-minute session keepalive after all players disconnect (up from 60s)
- [x] Cleanup cancellation on successful rejoin
- [x] Auto-pause on disconnect (timer stops until rejoin)
- [x] "Reconnecting..." UI in lobby with cancel option
- [x] Session data cleared on game completion/failure

### Infrastructure ✅
- [x] Dockerfile with multi-stage build (deps → build → production)
- [x] .dockerignore for clean builds
- [x] Server build script (tsconfig.server.json)
- [x] Vitest test scaffolding (23 tests passing)
- [x] Session store tests (create, reconnect tokens, validate, solve puzzle)
- [x] Validation tests (sanitize, isValidString, isValidId, rate limiter)
- [x] REST endpoint GET /api/sessions/:id/alive for reconnect probing

## What Needs Building Next

### Remaining Puzzle Types
- [ ] Jigsaw puzzle component (drag pieces)
- [ ] Slider puzzle component
- [ ] Logic grid component

### Further Polish
- [ ] Ambient room sounds (configurable per room atmosphere)
- [ ] Transition animations between rooms
- [ ] Session history and stats
- [ ] Mobile-specific layout optimizations (tested on real devices)

### Infrastructure (Remaining)
- [ ] Persistent sessions (Redis/SQLite) — currently in-memory only
- [x] Server build pipeline (tsconfig.server.json)
- [x] Automated tests (vitest)
- [x] Docker/deployment config (Dockerfile + .dockerignore)
- [ ] Rotate leaked API keys & remove .env.local from git
- [ ] CI/CD pipeline (GitHub Actions)

## Validated Opus Output

The generation prompt has been tested with Opus. A sample doctor's office session produced:
- 7 puzzles with traceable clue chains
- 4 co-op puzzles (57%) with specific per-player screen descriptions
- Branching dependency graph with 2 entry puzzles and 2 convergence points
- 3 red herrings (pen cup, blue binder, fern + sandwich)
- Strong narrative arc with 6 story beats
- 20+ objects across 2 rooms with proper zone assignments

Known prompt improvements to make:
- Clarify "concatenate" vs "add" for combination lock clues (ambiguity in medicine cabinet puzzle)
- Prevent splitting single puzzles into two steps (chemistry calc + safe entry should be one puzzle)
- Ensure convergence puzzles feel earned, not trivially derived from their name (NR-7 → 0007 was too easy)
