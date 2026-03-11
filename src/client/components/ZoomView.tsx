"use client";

import { useEffect } from "react";
import { useGameStore } from "@client/store/game-store";
import { useAssetStore } from "@client/store/asset-store";
import {
  getRooms,
  getZones,
  getObjects,
  getPuzzles,
  id as getId,
  getPosition,
} from "@client/lib/normalize";
import { PuzzleRouter } from "./puzzles/PuzzleRouter";
import { SpriteOverlay } from "./SpriteOverlay";

interface Props {
  zoneId: string;
  onZoomOut: () => void;
  onPickUpObject: (objectId: string) => void;
  onInspectObject: (objectId: string) => void;
  onAttemptPuzzle: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onCoopConfirm?: (puzzleId: string) => void;
  onCoopReject?: (puzzleId: string) => void;
}

export function ZoomView({
  zoneId,
  onZoomOut,
  onPickUpObject,
  onInspectObject,
  onAttemptPuzzle,
  onRequestHint,
  onCoopConfirm,
  onCoopReject,
}: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const escapeRoom = useGameStore((s) => s.escapeRoom);
  const playerId = useGameStore((s) => s.playerId);

  // Keyboard: Escape to zoom out (when no active puzzle)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZoomOut();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onZoomOut]);

  if (!gameState || !escapeRoom || !playerId) return null;

  const playerIdx = playerId === "player_1" ? 0 : 1;
  const player = gameState.players[playerIdx];
  const currentRoomId = player.currentRoom;
  const activePuzzle = player.activePuzzle;

  const rooms = getRooms(escapeRoom);
  const room = rooms.find((r: any) => getId.room(r) === currentRoomId);
  if (!room) return null;

  const zones = getZones(room);
  const zone = zones.find((z: any) => getId.zone(z) === zoneId);
  if (!zone) return null;

  const allObjects = getObjects(escapeRoom);
  const allPuzzles = getPuzzles(escapeRoom);
  const lighting = room.atmosphere?.lighting ?? "dim";

  // Background image for zoomed crop
  const backgroundUrl = useAssetStore((s) => s.backgrounds[currentRoomId]);
  const zonePos = getPosition(zone);

  // Current zone state
  const currentStateId =
    gameState.zoneStates[zoneId] ?? zone.default_state ?? zone.defaultState;
  const zoneState = (zone.states ?? []).find(
    (s: any) => (s.state_id ?? s.stateId) === currentStateId
  );

  // Objects in this zone that are visible
  const zoneObjectIds: string[] = zone.contains ?? [];
  const visibleWorldObjects = zoneObjectIds.filter((oid: string) =>
    gameState.objectsInWorld.includes(oid)
  );

  // Also show objects from other zones in this room that are in the world
  // (so players always see them even when exploring "wrong" zones)
  const allRoomZones = getZones(room);
  const allRoomObjectIds = new Set<string>();
  for (const z of allRoomZones) {
    for (const oid of (z.contains ?? [])) {
      allRoomObjectIds.add(oid);
    }
  }
  const otherRoomObjects = [...allRoomObjectIds]
    .filter((oid: string) =>
      gameState.objectsInWorld.includes(oid) && !zoneObjectIds.includes(oid)
    );

  // ALL puzzles in this room (available, locked, and solved)
  const roomPuzzles = allPuzzles.filter((p: any) => {
    const pRoom = p.room_id ?? p.roomId;
    return pRoom === currentRoomId;
  });

  // Split into available (unsolved) and locked
  const availablePuzzles = roomPuzzles.filter((p: any) => {
    const pid = getId.puzzle(p);
    return gameState.puzzlesAvailable.includes(pid) && !gameState.puzzlesSolved.includes(pid);
  });

  const lockedPuzzles = roomPuzzles.filter((p: any) => {
    const pid = getId.puzzle(p);
    return !gameState.puzzlesAvailable.includes(pid) && !gameState.puzzlesSolved.includes(pid);
  });

  const solvedPuzzles = roomPuzzles.filter((p: any) => {
    const pid = getId.puzzle(p);
    return gameState.puzzlesSolved.includes(pid);
  });

  // Co-op labels
  const playerLabel = playerId === "player_1" ? "player1Sees" : "player2Sees";
  const playerLabelSnake = playerId === "player_1" ? "player_1_sees" : "player_2_sees";

  // Active puzzle UI
  if (activePuzzle) {
    const puzzle = allPuzzles.find(
      (p: any) => getId.puzzle(p) === activePuzzle
    );
    if (puzzle) {
      return (
        <div className="w-full h-full flex items-center justify-center p-8 relative">
          {/* Blurred background */}
          <ZoomBackground url={backgroundUrl} zonePos={zonePos} />
          <div className="relative z-10">
            <PuzzleRouter
              puzzle={puzzle}
              onAttempt={onAttemptPuzzle}
              onRequestHint={onRequestHint}
              onCoopConfirm={onCoopConfirm}
              onCoopReject={onCoopReject}
              onClose={onZoomOut}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Zoomed background */}
      <ZoomBackground url={backgroundUrl} zonePos={zonePos} />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4">
          <div>
            <h2 className="text-white font-display text-xl drop-shadow-lg">
              {zone.name}
            </h2>
            <p className="text-gray-400 text-sm mt-0.5 drop-shadow">
              {zone.visual_description ?? zone.visualDescription}
            </p>
          </div>
          <button
            onClick={onZoomOut}
            className="px-3 py-1.5 bg-void-600/80 backdrop-blur border border-void-500 rounded-lg text-gray-400 hover:text-white text-sm"
          >
            Back to Room
          </button>
        </div>

        {/* Zone state */}
        {zoneState?.description && (
          <div className="mx-6 mt-3 p-3 bg-void-800/60 backdrop-blur border border-void-600 rounded-lg">
            <p className="text-gray-300 text-sm">{zoneState.description}</p>
            {(zoneState.visual_change ?? zoneState.visualChange) && (
              <p className="text-iris-400 text-xs mt-1">
                {zoneState.visual_change ?? zoneState.visualChange}
              </p>
            )}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
          {/* Objects */}
          {visibleWorldObjects.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-xs font-mono uppercase mb-3">
                Objects
              </h3>
              <div className="space-y-2">
                {visibleWorldObjects.map((objId) => {
                  const obj = allObjects.find(
                    (o: any) => getId.object(o) === objId
                  );
                  if (!obj) return null;

                  const name = obj.name ?? objId;
                  const desc = obj.description ?? "";
                  const category =
                    obj.category ?? obj.object_category ?? "environmental";
                  const visibility =
                    (obj as any).player_visibility ?? obj.playerVisibility ?? "both";

                  if (visibility !== "both" && visibility !== playerId) return null;

                  // Check if object is portable: not environmental/red_herring,
                  // and not a fixed-in-place clue (wall scratchings, engravings, etc.)
                  const nameLC = name.toLowerCase();
                  const descLC = desc.toLowerCase();
                  const isFixed = /\b(scratching|engraving|carving|mural|plaque|sign|inscription|etching|marking|painted|mounted|bolted|built[- ]in|fixture|valve|panel)\b/i.test(nameLC + " " + descLC);
                  const canPickup =
                    category !== "environmental" && category !== "red_herring" && !isFixed;
                  const sizeCategory = (obj as any).size_category ?? (obj as any).sizeCategory ?? "medium";

                  return (
                    <div
                      key={objId}
                      className="p-3 bg-void-700/70 backdrop-blur border border-void-500 rounded-lg hover:border-void-400 transition-colors flex items-center gap-3"
                    >
                      <SpriteOverlay
                        objectId={objId}
                        name={name}
                        lighting={lighting}
                        size={sizeCategory === "large" ? "large" : sizeCategory === "small" ? "small" : "medium"}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white text-sm font-medium truncate">
                            {name}
                          </span>
                          <span className="text-gray-600 text-xs ml-2 shrink-0">
                            {category.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5 truncate">{desc}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => onInspectObject(objId)}
                          className="px-2 py-1 bg-void-600 border border-void-500 rounded text-gray-400 hover:text-white text-xs"
                        >
                          Inspect
                        </button>
                        {canPickup && (
                          <button
                            onClick={() => onPickUpObject(objId)}
                            className="px-2 py-1 bg-iris-400/10 border border-iris-400/30 rounded text-iris-400 hover:bg-iris-400/20 text-xs"
                          >
                            Pick Up
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Puzzles */}
          {availablePuzzles.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-xs font-mono uppercase mb-3">
                Puzzles
              </h3>
              <div className="space-y-2">
                {availablePuzzles.map((puzzle: any) => {
                  const pid = getId.puzzle(puzzle);
                  const name = puzzle.name ?? "";
                  const type = puzzle.config?.type ?? puzzle.type ?? "";
                  const flavor = puzzle.flavor_text ?? puzzle.flavorText ?? "";
                  const coopMode = puzzle.coop?.mode ?? "solo";
                  const coopDesc =
                    puzzle.coop?.[playerLabel] ??
                    puzzle.coop?.[playerLabelSnake] ??
                    "";

                  // Check required objects
                  const reqObjs: string[] =
                    puzzle.requires_objects ?? puzzle.requiresObjects ?? [];
                  const inventory = player.inventory ?? [];
                  const hasAllRequired =
                    reqObjs.length === 0 ||
                    reqObjs.every((r: string) => inventory.includes(r));

                  // Type-based styling
                  const isObservation = type === "observation";
                  const isInventoryUse = type === "inventory_use";
                  const borderClass = isObservation
                    ? "border-emerald-400/20 hover:border-emerald-400/50"
                    : isInventoryUse
                    ? "border-amber-400/20 hover:border-amber-400/50"
                    : "border-iris-400/20 hover:border-iris-400/50";
                  const nameHoverClass = isObservation
                    ? "group-hover:text-emerald-400"
                    : isInventoryUse
                    ? "group-hover:text-amber-400"
                    : "group-hover:text-iris-400";

                  return (
                    <button
                      key={pid}
                      onClick={() => onAttemptPuzzle(pid, null)}
                      className={`w-full p-3 bg-void-700/70 backdrop-blur border rounded-lg transition-colors text-left group ${borderClass}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-white text-sm font-medium transition-colors ${nameHoverClass}`}>
                          {name}
                        </span>
                        <span className="text-gray-600 text-xs font-mono">
                          {isObservation ? "look" : isInventoryUse ? "use item" : type.replace(/_/g, " ")}
                        </span>
                      </div>
                      {flavor && (
                        <p className="text-gray-500 text-xs mt-1 italic">
                          {flavor}
                        </p>
                      )}
                      {reqObjs.length > 0 && (
                        <div className={`text-xs mt-1 ${hasAllRequired ? "text-emerald-400" : "text-red-400/70"}`}>
                          {hasAllRequired ? "Required items ready" : `Needs: ${reqObjs.map((r: string) => {
                            const obj = allObjects.find((o: any) => getId.object(o) === r);
                            return obj?.name ?? r;
                          }).join(", ")}`}
                        </div>
                      )}
                      {coopMode !== "solo" && (
                        <div className="text-sky-400 text-xs mt-1">
                          Co-op: {coopMode.replace(/_/g, " ")}
                          {coopDesc && (
                            <span className="text-gray-500 ml-1">— {coopDesc}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Objects in nearby zones */}
          {otherRoomObjects.length > 0 && visibleWorldObjects.length === 0 && (
            <div>
              <h3 className="text-gray-400 text-xs font-mono uppercase mb-3">
                Nearby Objects
              </h3>
              <div className="space-y-2">
                {otherRoomObjects.map((objId) => {
                  const obj = allObjects.find(
                    (o: any) => getId.object(o) === objId
                  );
                  if (!obj) return null;
                  const name = obj.name ?? objId;
                  const desc = obj.description ?? "";
                  const visibility =
                    (obj as any).player_visibility ?? obj.playerVisibility ?? "both";
                  if (visibility !== "both" && visibility !== playerId) return null;
                  // Find which zone contains this object
                  const ownerZone = allRoomZones.find((z: any) =>
                    (z.contains ?? []).includes(objId)
                  );
                  const zoneName = ownerZone?.name ?? "nearby";

                  return (
                    <div
                      key={objId}
                      className="p-3 bg-void-700/50 backdrop-blur border border-void-600 rounded-lg flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-300 text-sm">{name}</span>
                        <p className="text-gray-600 text-xs mt-0.5 truncate">{desc}</p>
                      </div>
                      <span className="text-gray-600 text-xs shrink-0">in {zoneName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Locked Puzzles */}
          {lockedPuzzles.length > 0 && (
            <div>
              <h3 className="text-gray-500 text-xs font-mono uppercase mb-3">
                Locked
              </h3>
              <div className="space-y-2">
                {lockedPuzzles.map((puzzle: any) => {
                  const pid = getId.puzzle(puzzle);
                  const name = puzzle.name ?? "";
                  const reqs: string[] = puzzle.requires ?? [];
                  const reqNames = reqs.map((r: string) => {
                    const rp = allPuzzles.find((p: any) => getId.puzzle(p) === r);
                    return rp?.name ?? r;
                  });

                  return (
                    <div
                      key={pid}
                      className="w-full p-3 bg-void-800/50 border border-void-600/50 rounded-lg text-left opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm">{name}</span>
                        <span className="text-gray-600 text-xs font-mono">locked</span>
                      </div>
                      {reqNames.length > 0 && (
                        <p className="text-gray-600 text-xs mt-1">
                          Requires: {reqNames.join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Solved Puzzles */}
          {solvedPuzzles.length > 0 && (
            <div>
              <h3 className="text-emerald-400/50 text-xs font-mono uppercase mb-3">
                Solved
              </h3>
              <div className="space-y-2">
                {solvedPuzzles.map((puzzle: any) => {
                  const pid = getId.puzzle(puzzle);
                  const name = puzzle.name ?? "";
                  return (
                    <div
                      key={pid}
                      className="w-full p-2 bg-emerald-400/5 border border-emerald-400/10 rounded-lg text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400/60 text-sm line-through">{name}</span>
                        <span className="text-emerald-400/40 text-xs font-mono">done</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {visibleWorldObjects.length === 0 && availablePuzzles.length === 0 && lockedPuzzles.length === 0 && otherRoomObjects.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center text-center">
              <p className="text-gray-600 text-sm">Nothing here yet.</p>
              <p className="text-gray-700 text-xs mt-1">Solve puzzles elsewhere to unlock new areas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders a zoomed crop of the room background, or a dark fallback */
function ZoomBackground({
  url,
  zonePos,
}: {
  url: string | undefined;
  zonePos: { x: number; y: number; width: number; height: number };
}) {
  if (!url) {
    return <div className="absolute inset-0 bg-gradient-to-b from-void-800 to-void-900" />;
  }

  return (
    <div
      className="absolute inset-0 zoom-bg-blur"
      style={{
        backgroundImage: `url(${url})`,
        backgroundPosition: `${zonePos.x}% ${zonePos.y}%`,
        backgroundSize: "300%",
      }}
    />
  );
}
