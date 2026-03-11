"use client";

import { useMemo } from "react";
import { useGameStore } from "@client/store/game-store";
import { HUD } from "./HUD";
import { RoomRenderer } from "./RoomRenderer";
import { ZoomView } from "./ZoomView";
import { InventoryBar } from "./InventoryBar";
import { Chat } from "./Chat";
import { Notifications } from "./Notifications";
import { InspectionModal, NarrativeModal, HintModal } from "./Modals";

interface Props {
  actions: {
    moveToRoom: (roomId: string) => void;
    zoomInto: (zoneId: string) => void;
    zoomOut: () => void;
    pickUpObject: (objectId: string) => void;
    inspectObject: (objectId: string) => void;
    combineObjects: (a: string, b: string) => void;
    useObject: (objectId: string, targetZoneId: string) => void;
    attemptPuzzle: (puzzleId: string, answer: unknown) => void;
    requestHint: (puzzleId: string) => void;
    coopConfirm?: (puzzleId: string) => void;
    coopReject?: (puzzleId: string) => void;
    sendChat: (message: string) => void;
    pauseGame: () => void;
    resumeGame: () => void;
    offerObject?: (objectId: string) => void;
  };
}

export function GameView({ actions }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const escapeRoom = useGameStore((s) => s.escapeRoom);

  if (!gameState || !playerId) return null;

  const playerIdx = playerId === "player_1" ? 0 : 1;
  const player = gameState.players[playerIdx];
  const view = player.currentView;
  const zoomTarget = player.zoomTarget;

  const isPaused = gameState.status === "paused";
  const isCompleted = gameState.status === "completed";
  const isFailed = gameState.status === "failed";

  const totalPuzzles = escapeRoom?.puzzles?.length ?? 0;

  return (
    <div className="w-screen h-screen flex flex-col bg-void-900 overflow-hidden">
      {/* HUD */}
      <HUD onPause={actions.pauseGame} onResume={actions.resumeGame} />

      {/* Main game area - below HUD, above inventory */}
      <div className="flex-1 mt-12 mb-14 relative">
        {/* Pause overlay */}
        {isPaused && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-white font-display text-3xl mb-2">Paused</h2>
              <p className="text-gray-400 text-sm mb-4">
                The clock is stopped.
              </p>
              <button
                onClick={actions.resumeGame}
                className="px-6 py-2 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg focus-ring"
              >
                Resume
              </button>
            </div>
          </div>
        )}

        {/* Victory screen */}
        {isCompleted && (
          <VictoryScreen
            elapsedSeconds={gameState.elapsedSeconds}
            hintsUsed={gameState.hintsUsed}
            puzzlesSolved={gameState.puzzlesSolved.length}
            totalPuzzles={totalPuzzles}
            conclusion={
              (escapeRoom as any)?.narrative?.conclusion ??
              escapeRoom?.narrative?.conclusion ??
              ""
            }
          />
        )}

        {/* Failure screen */}
        {isFailed && (
          <FailureScreen
            puzzlesSolved={gameState.puzzlesSolved.length}
            totalPuzzles={totalPuzzles}
            timeLimitSeconds={gameState.timeLimitSeconds}
          />
        )}

        {/* Room view */}
        {view === "room" && !isCompleted && !isFailed && (
          <RoomRenderer
            onZoomInto={actions.zoomInto}
            onMoveToRoom={actions.moveToRoom}
            onPickUpObject={actions.pickUpObject}
          />
        )}

        {/* Zoom view */}
        {view === "zoom" && zoomTarget && !isCompleted && !isFailed && (
          <ZoomView
            zoneId={zoomTarget}
            onZoomOut={actions.zoomOut}
            onPickUpObject={actions.pickUpObject}
            onInspectObject={actions.inspectObject}
            onAttemptPuzzle={actions.attemptPuzzle}
            onRequestHint={actions.requestHint}
            onCoopConfirm={actions.coopConfirm}
            onCoopReject={actions.coopReject}
          />
        )}
      </div>

      {/* Inventory bar */}
      {!isCompleted && !isFailed && (
        <InventoryBar
          onInspect={actions.inspectObject}
          onCombine={actions.combineObjects}
          onUseObject={actions.useObject}
          onOfferObject={actions.offerObject}
          activeZoneId={view === "zoom" ? zoomTarget : null}
        />
      )}

      {/* Chat */}
      <Chat onSend={actions.sendChat} />

      {/* Notifications */}
      <Notifications />

      {/* Modals */}
      <InspectionModal />
      <NarrativeModal />
      <HintModal />
    </div>
  );
}

/* ===== Victory Screen ===== */
function VictoryScreen({
  elapsedSeconds,
  hintsUsed,
  puzzlesSolved,
  totalPuzzles,
  conclusion,
}: {
  elapsedSeconds: number;
  hintsUsed: number;
  puzzlesSolved: number;
  totalPuzzles: number;
  conclusion: string;
}) {
  const confettiColors = ["#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6"];
  const particles = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: confettiColors[i % confettiColors.length],
        delay: Math.random() * 3,
        duration: 2.5 + Math.random() * 2,
        size: 5 + Math.random() * 8,
      })),
    [],
  );

  // Rating based on hints & completion
  const rating =
    hintsUsed === 0
      ? "Flawless"
      : hintsUsed <= 2
        ? "Excellent"
        : hintsUsed <= 5
          ? "Well Done"
          : "Escaped";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center fade-to-black bg-black/80 backdrop-blur-md overflow-hidden">
      {/* Confetti */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}

      <div className="relative z-10 text-center max-w-lg mx-auto px-6">
        {/* Title */}
        <h2 className="text-emerald-400 font-display text-5xl sm:text-6xl mb-3 victory-glow fade-in-up">
          Escaped!
        </h2>

        {/* Rating */}
        <div className="fade-in-up-delay-1">
          <span className="inline-block px-4 py-1.5 bg-emerald-400/10 border border-emerald-400/30 rounded-full text-emerald-400 font-mono text-sm">
            {rating}
          </span>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4 fade-in-up-delay-2">
          <div className="p-3 bg-void-800/60 rounded-lg border border-void-600">
            <div className="text-white font-mono text-2xl font-bold">
              {formatTime(elapsedSeconds)}
            </div>
            <div className="text-gray-500 text-xs mt-1">Time</div>
          </div>
          <div className="p-3 bg-void-800/60 rounded-lg border border-void-600">
            <div className="text-white font-mono text-2xl font-bold">
              {puzzlesSolved}/{totalPuzzles}
            </div>
            <div className="text-gray-500 text-xs mt-1">Puzzles</div>
          </div>
          <div className="p-3 bg-void-800/60 rounded-lg border border-void-600">
            <div className="text-white font-mono text-2xl font-bold">{hintsUsed}</div>
            <div className="text-gray-500 text-xs mt-1">Hints</div>
          </div>
        </div>

        {/* Narrative conclusion */}
        {conclusion && (
          <div className="mt-6 p-4 bg-void-800/40 border border-emerald-400/10 rounded-lg fade-in-up-delay-3">
            <p className="text-gray-300 text-sm leading-relaxed italic">
              {conclusion}
            </p>
          </div>
        )}

        {/* Action */}
        <div className="mt-8 fade-in-up-delay-3">
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-gradient-to-r from-emerald-400 to-green-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity focus-ring"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Failure Screen ===== */
function FailureScreen({
  puzzlesSolved,
  totalPuzzles,
  timeLimitSeconds,
}: {
  puzzlesSolved: number;
  totalPuzzles: number;
  timeLimitSeconds: number;
}) {
  const unsolved = totalPuzzles - puzzlesSolved;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center fade-to-black bg-black/85 backdrop-blur-md">
      <div className="text-center max-w-lg mx-auto px-6">
        {/* Title */}
        <h2 className="text-scarlet-400 font-display text-5xl sm:text-6xl mb-3 fade-in-up">
          Time's Up
        </h2>

        <p className="text-gray-400 text-lg fade-in-up-delay-1">
          The room claimed you.
        </p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 fade-in-up-delay-2">
          <div className="p-3 bg-void-800/60 rounded-lg border border-void-600">
            <div className="text-white font-mono text-2xl font-bold">
              {puzzlesSolved}/{totalPuzzles}
            </div>
            <div className="text-gray-500 text-xs mt-1">Puzzles Solved</div>
          </div>
          <div className="p-3 bg-void-800/60 rounded-lg border border-void-600">
            <div className="text-scarlet-400 font-mono text-2xl font-bold">{unsolved}</div>
            <div className="text-gray-500 text-xs mt-1">Mysteries Remain</div>
          </div>
        </div>

        {/* Flavor text */}
        <div className="mt-6 p-4 bg-void-800/40 border border-scarlet-400/10 rounded-lg fade-in-up-delay-2">
          <p className="text-gray-400 text-sm italic">
            {unsolved === 1
              ? "So close... just one more puzzle stood between you and freedom."
              : unsolved <= 3
                ? "The answers were within reach, but time was not on your side."
                : "The room's secrets remain locked away, waiting for the next brave souls."}
          </p>
        </div>

        {/* Action */}
        <div className="mt-8 fade-in-up-delay-3">
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-gradient-to-r from-scarlet-400 to-red-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity focus-ring"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
