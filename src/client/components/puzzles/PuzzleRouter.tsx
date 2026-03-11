"use client";

import { useState, useEffect, useCallback } from "react";
import type { Puzzle, PlayerId } from "@shared/types";
import { useGameStore } from "@client/store/game-store";
import { CombinationLock } from "./CombinationLock";
import { CipherInput } from "./CipherInput";
import { SequenceSelector } from "./SequenceSelector";
import { PatternInput } from "./PatternInput";
import { MatchingPuzzle } from "./MatchingPuzzle";
import { WiringPuzzle } from "./WiringPuzzle";

const SUPPORTED_TYPES = [
  "combination_lock",
  "cipher",
  "sequence",
  "pattern",
  "symbol_match",
  "matching",
  "drag_arrange",
  "wiring",
  "observation",
  "inventory_use",
  "riddle",
  "search",
  "word_puzzle",
];

interface Props {
  puzzle: Puzzle;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onCoopConfirm?: (puzzleId: string) => void;
  onCoopReject?: (puzzleId: string) => void;
  onClose: () => void;
}

export function PuzzleRouter({ puzzle, onAttempt, onRequestHint, onCoopConfirm, onCoopReject, onClose }: Props) {
  const pid = (puzzle as any).puzzle_id ?? puzzle.puzzleId;
  const name = puzzle.name ?? "";
  const flavor = (puzzle as any).flavor_text ?? puzzle.flavorText ?? "";
  const config = puzzle.config as any;
  let type = config?.type ?? (puzzle as any).type;

  // Detect mislabeled puzzles and normalize aliases
  if (type === "combination_lock" && (config?.pattern_elements || config?.patternElements)) {
    type = "pattern";
  }
  if (config?.encrypted_text || config?.encryptedText) {
    type = "cipher";
  }
  if (type === "matching") {
    type = "symbol_match";
  }
  if (type === "riddle" || type === "search" || type === "word_puzzle") {
    type = "cipher";
  }

  const coopInfo = puzzle.coop ?? (puzzle as any).coop_info;
  const coopMode = coopInfo?.mode;
  const playerId = useGameStore((s) => s.playerId);
  const pendingCoopConfirm = useGameStore((s) => s.pendingCoopConfirm);

  // Sequential confirm: P2 sees confirm/reject UI instead of puzzle
  const isAwaitingMyConfirm =
    coopMode === "sequential_confirm" &&
    pendingCoopConfirm?.puzzleId === pid &&
    pendingCoopConfirm?.fromPlayer !== playerId;

  // Sequential confirm: P1 submitted, waiting for P2
  const isAwaitingPartnerConfirm =
    coopMode === "sequential_confirm" &&
    pendingCoopConfirm?.puzzleId === pid &&
    pendingCoopConfirm?.fromPlayer === playerId;

  // Puzzle feedback state
  const lastResult = useGameStore((s) => s.lastPuzzleResult);
  const feedbackClass =
    lastResult && lastResult.puzzleId === pid
      ? lastResult.correct
        ? "puzzle-correct"
        : "puzzle-wrong"
      : "";

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wrappedAttempt = useCallback(
    (puzzleId: string, answer: unknown) => {
      setIsSubmitting(true);
      onAttempt(puzzleId, answer);
      // Clear submitting on result
      setTimeout(() => setIsSubmitting(false), 1500);
    },
    [onAttempt],
  );

  // Clear submitting when result arrives
  useEffect(() => {
    if (lastResult?.puzzleId === pid) {
      setIsSubmitting(false);
    }
  }, [lastResult, pid]);

  // Keyboard: Escape closes puzzle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Per-player co-op content (handle both camelCase and snake_case from Opus)
  const coopPlayerText =
    playerId === "player_1"
      ? (coopInfo?.player1Sees ?? (coopInfo as any)?.player_1_sees ?? "")
      : (coopInfo?.player2Sees ?? (coopInfo as any)?.player_2_sees ?? "");
  const collaborationHint =
    coopInfo?.collaborationHint ?? (coopInfo as any)?.collaboration_hint ?? "";

  return (
    <div className={`flex flex-col items-center transition-all ${feedbackClass}`}>
      {/* Submitting spinner */}
      {isSubmitting && (
        <div className="mb-3 flex items-center gap-2">
          <div className="spinner" />
          <span className="text-gray-400 text-xs">Checking...</span>
        </div>
      )}

      {/* Co-op badge */}
      {coopMode && coopMode !== "solo" && (
        <div className="mb-2 px-3 py-1 bg-sky-400/10 border border-sky-400/30 rounded-full text-sky-400 text-xs font-mono">
          Co-op: {coopMode.replace(/_/g, " ")}
        </div>
      )}

      {/* Per-player co-op info */}
      {coopPlayerText && (
        <div className="mb-4 w-full max-w-md p-3 bg-sky-400/5 border border-sky-400/20 rounded-lg">
          <div className="text-sky-400 text-xs font-mono uppercase mb-1">Your Info</div>
          <p className="text-gray-300 text-sm">{coopPlayerText}</p>
          {collaborationHint && (
            <p className="text-gray-500 text-xs mt-1 italic">{collaborationHint}</p>
          )}
        </div>
      )}

      {/* Sequential Confirm: P2 sees confirm/reject UI */}
      {isAwaitingMyConfirm && (
        <div className="mb-4 w-full max-w-md p-4 bg-amber-400/5 border border-amber-400/30 rounded-lg">
          <div className="text-amber-400 text-xs font-mono uppercase mb-2">Partner Submitted</div>
          <p className="text-gray-300 text-sm mb-1">
            Your partner submitted an answer for this puzzle.
          </p>
          {pendingCoopConfirm?.action && (
            <p className="text-gray-400 text-xs italic mb-3">{pendingCoopConfirm.action}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onCoopConfirm?.(pid)}
              className="flex-1 py-2 bg-gradient-to-r from-emerald-400 to-green-600 text-white font-bold rounded-lg hover:opacity-90 text-sm"
            >
              Confirm
            </button>
            <button
              onClick={() => onCoopReject?.(pid)}
              className="flex-1 py-2 bg-gradient-to-r from-scarlet-400 to-red-600 text-white font-bold rounded-lg hover:opacity-90 text-sm"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Sequential Confirm: P1 waiting for P2 */}
      {isAwaitingPartnerConfirm && (
        <div className="mb-4 w-full max-w-md p-4 bg-iris-400/5 border border-iris-400/30 rounded-lg text-center">
          <div className="spinner mx-auto mb-2" />
          <p className="text-iris-400 text-sm font-mono">
            Waiting for partner to confirm your answer...
          </p>
        </div>
      )}

      {type === "combination_lock" && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <CombinationLock
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          onAttempt={wrappedAttempt}
          onRequestHint={onRequestHint}
          onClose={onClose}
        />
      )}

      {type === "cipher" && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <CipherInput
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          onAttempt={wrappedAttempt}
          onRequestHint={onRequestHint}
          onClose={onClose}
        />
      )}

      {type === "sequence" && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <SequenceSelector
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          onAttempt={wrappedAttempt}
          onRequestHint={onRequestHint}
          onClose={onClose}
        />
      )}

      {type === "pattern" && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <PatternInput
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          onAttempt={wrappedAttempt}
          onRequestHint={onRequestHint}
          onClose={onClose}
        />
      )}

      {(type === "symbol_match" || type === "drag_arrange") && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <MatchingPuzzle
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          puzzleType={type}
          onAttempt={wrappedAttempt}
          onRequestHint={onRequestHint}
          onClose={onClose}
        />
      )}

      {type === "wiring" && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <WiringPuzzle
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          onAttempt={wrappedAttempt}
          onRequestHint={onRequestHint}
          onClose={onClose}
        />
      )}

      {type === "observation" && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <ObservationPuzzle
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          onAttempt={wrappedAttempt}
          onClose={onClose}
        />
      )}

      {type === "inventory_use" && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <InventoryUsePuzzle
          key={pid}
          config={config}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          onClose={onClose}
        />
      )}

      {/* Generic fallback for truly unknown types */}
      {type && !SUPPORTED_TYPES.includes(type) && !isAwaitingMyConfirm && !isAwaitingPartnerConfirm && (
        <GenericPuzzle
          key={pid}
          puzzleId={pid}
          puzzleName={name}
          flavorText={flavor}
          type={type}
          onAttempt={wrappedAttempt}
          onRequestHint={onRequestHint}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/** Observation puzzle — solved by confirming you noticed something */
function ObservationPuzzle({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  onAttempt,
  onClose,
}: {
  config: any;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onClose: () => void;
}) {
  const whatToNotice =
    config.what_to_notice ?? config.whatToNotice ?? "";
  const significance =
    config.significance ?? "";

  return (
    <div className="flex flex-col items-center gap-6 max-w-md w-full">
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
      </div>

      <div className="w-full p-4 bg-void-800 border border-iris-400/20 rounded-lg text-center">
        <p className="text-gray-400 text-sm">
          Look carefully at your surroundings...
        </p>
        {whatToNotice && (
          <p className="text-iris-400 text-sm mt-3 font-medium">{whatToNotice}</p>
        )}
      </div>

      <button
        onClick={() => onAttempt(puzzleId, "observed")}
        className="w-full py-3 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg hover:opacity-90 text-sm"
      >
        I see it!
      </button>

      <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">
        Back
      </button>
    </div>
  );
}

/** Inventory use puzzle — tells the player what item to use */
function InventoryUsePuzzle({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  onClose,
}: {
  config: any;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  onClose: () => void;
}) {
  const interaction =
    config.interaction_description ?? config.interactionDescription ?? "";
  const requiredObj =
    config.required_object_id ?? config.requiredObjectId ?? "";

  return (
    <div className="flex flex-col items-center gap-6 max-w-md w-full">
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
      </div>

      <div className="w-full p-4 bg-void-800 border border-amber-400/20 rounded-lg text-center">
        {interaction && (
          <p className="text-gray-400 text-sm">{interaction}</p>
        )}
        <p className="text-amber-400 text-xs mt-3 font-mono">
          Use the correct item from your inventory on this zone.
        </p>
        {requiredObj && (
          <p className="text-gray-600 text-xs mt-1">
            Hint: You need a specific item...
          </p>
        )}
      </div>

      <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">
        Back
      </button>
    </div>
  );
}

/** Generic fallback for truly unknown puzzle types */
function GenericPuzzle({
  puzzleId,
  puzzleName,
  flavorText,
  type,
  onAttempt,
  onRequestHint,
  onClose,
}: {
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  type: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onClose: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const handleSubmit = () => {
    if (!answer.trim()) return;
    onAttempt(puzzleId, answer.trim());
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-md w-full">
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
      </div>

      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Enter your answer..."
        className="w-full p-3 bg-void-700 border border-void-500 rounded-lg text-white placeholder-gray-600 focus:border-iris-400 focus:outline-none text-center"
      />

      <div className="flex gap-2 w-full">
        <button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className="flex-1 py-2 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg hover:opacity-90 text-sm disabled:opacity-40"
        >
          Submit
        </button>
        <button
          onClick={() => onRequestHint(puzzleId)}
          className="px-3 py-2 bg-void-600 border border-amber-400/30 text-amber-400 rounded-lg hover:bg-void-500 text-sm"
        >
          Hint
        </button>
      </div>

      <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">
        Back
      </button>
    </div>
  );
}
