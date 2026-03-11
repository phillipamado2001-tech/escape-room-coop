"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@client/store/game-store";
import { getRooms, getZones, id as getId } from "@client/lib/normalize";
import { audio } from "@client/lib/audio";

export function HUD({
  onPause,
  onResume,
}: {
  onPause: () => void;
  onResume: () => void;
}) {
  const gameState = useGameStore((s) => s.gameState);
  const escapeRoom = useGameStore((s) => s.escapeRoom);
  const playerId = useGameStore((s) => s.playerId);
  const soundMuted = useGameStore((s) => s.soundMuted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const lastPuzzleResult = useGameStore((s) => s.lastPuzzleResult);

  // Track partner solve flash
  const [partnerSolvedFlash, setPartnerSolvedFlash] = useState(false);

  if (!gameState || !escapeRoom) return null;

  const playerIdx = playerId === "player_1" ? 0 : 1;
  const player = gameState.players[playerIdx];
  const partner = gameState.players[playerIdx === 0 ? 1 : 0];

  const remaining = gameState.timeLimitSeconds - gameState.elapsedSeconds;
  const minutes = Math.floor(Math.max(0, remaining) / 60);
  const seconds = Math.max(0, remaining) % 60;
  const isLow = remaining <= 60;

  // Find current room name
  const rooms = getRooms(escapeRoom);
  const currentRoom = rooms.find(
    (r: any) => getId.room(r) === player.currentRoom
  );
  const roomName =
    currentRoom?.name ?? currentRoom?.room_name ?? "Unknown Room";

  // Partner location
  const partnerRoom = rooms.find(
    (r: any) => getId.room(r) === partner.currentRoom
  );
  const partnerRoomName =
    partnerRoom?.name ?? partnerRoom?.room_name ?? "Unknown";
  const partnerZones = partnerRoom ? getZones(partnerRoom) : [];
  const partnerZone = partner.zoomTarget
    ? partnerZones.find((z: any) => getId.zone(z) === partner.zoomTarget)
    : null;
  const partnerZoneName = partnerZone?.name ?? null;
  const partnerInPuzzle = !!partner.activePuzzle;

  const totalPuzzles = escapeRoom.puzzles?.length ?? 0;
  const solvedCount = gameState.puzzlesSolved.length;
  const isPaused = gameState.status === "paused";

  // Handle mute toggle
  const handleToggleMute = () => {
    audio.toggleMute();
    toggleMute();
  };

  // Flash when partner solves something
  useEffect(() => {
    if (
      lastPuzzleResult?.correct &&
      lastPuzzleResult.puzzleId &&
      gameState.puzzlesSolved.includes(lastPuzzleResult.puzzleId)
    ) {
      setPartnerSolvedFlash(true);
      const t = setTimeout(() => setPartnerSolvedFlash(false), 3000);
      return () => clearTimeout(t);
    }
  }, [gameState.puzzlesSolved.length]);

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-void-900/90 backdrop-blur border-b border-void-500">
      <div className="flex items-center justify-between px-4 py-2 max-w-7xl mx-auto">
        {/* Left: Room & player info */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <div className="text-white font-medium text-sm truncate">{roomName}</div>
            <div className="text-gray-500 text-xs truncate">
              {player.displayName}
              {partner.connected && (
                <span
                  className={`text-emerald-400 ml-2 ${partnerSolvedFlash ? "partner-pulse" : ""}`}
                >
                  + {partner.displayName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Timer */}
        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? onResume : onPause}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 border border-void-500 rounded focus-ring"
            aria-label={isPaused ? "Resume game" : "Pause game"}
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <div
            className={`font-mono text-2xl font-bold tabular-nums ${
              isLow ? "text-scarlet-400 animate-pulse" : "text-white"
            }`}
            role="timer"
            aria-label={`${minutes} minutes ${seconds} seconds remaining`}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          {/* Mute button */}
          <button
            onClick={handleToggleMute}
            className="text-gray-400 hover:text-white mute-btn focus-ring rounded p-1"
            aria-label={soundMuted ? "Unmute sounds" : "Mute sounds"}
            title={soundMuted ? "Unmute" : "Mute"}
          >
            {soundMuted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
            )}
          </button>
        </div>

        {/* Right: Progress + Partner */}
        <div className="flex items-center gap-4 text-sm">
          {/* Partner presence */}
          {partner.connected && (
            <div className="hidden sm:block text-gray-500 text-xs border-r border-void-600 pr-4">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${partnerInPuzzle ? "bg-amber-400" : "bg-emerald-400"}`} />
                <span className="truncate max-w-[120px]">
                  {partnerInPuzzle
                    ? "Solving puzzle"
                    : partnerZoneName
                      ? `${partnerRoomName} > ${partnerZoneName}`
                      : partnerRoomName}
                </span>
              </div>
            </div>
          )}
          <div className="text-gray-400">
            Puzzles{" "}
            <span className="text-emerald-400 font-mono">
              {solvedCount}/{totalPuzzles}
            </span>
          </div>
          <div className="text-gray-400">
            Hints{" "}
            <span className="text-amber-400 font-mono">
              {gameState.hintsRemaining}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
