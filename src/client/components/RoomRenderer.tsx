"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@client/store/game-store";
import { useAssetStore } from "@client/store/asset-store";
import {
  getRooms,
  getZones,
  getTransitions,
  getObjects,
  getPuzzles,
  id as getId,
  getPosition,
} from "@client/lib/normalize";
import { ProceduralBackground } from "./ProceduralBackground";
import { SpriteOverlay } from "./SpriteOverlay";

interface Props {
  onZoomInto: (zoneId: string) => void;
  onMoveToRoom: (roomId: string) => void;
  onPickUpObject: (objectId: string) => void;
}

export function RoomRenderer({ onZoomInto, onMoveToRoom, onPickUpObject }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const escapeRoom = useGameStore((s) => s.escapeRoom);
  const playerId = useGameStore((s) => s.playerId);

  if (!gameState || !escapeRoom || !playerId) return null;

  const playerIdx = playerId === "player_1" ? 0 : 1;
  const player = gameState.players[playerIdx];
  const currentRoomId = player.currentRoom;

  const rooms = getRooms(escapeRoom);
  const room = rooms.find((r: any) => getId.room(r) === currentRoomId);
  if (!room) return null;

  const zones = getZones(room);
  const transitions = getTransitions(room);
  const allObjects = getObjects(escapeRoom);

  const lighting = room.atmosphere?.lighting ?? "dim";
  const ambientDesc =
    room.atmosphere?.ambient_description ??
    room.atmosphere?.ambientDescription ??
    "";
  const theme = escapeRoom.config?.theme ?? (escapeRoom as any).config?.theme ?? "";

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Background layer: image or procedural */}
      <BackgroundLayer roomId={currentRoomId} theme={theme} lighting={lighting} />

      {/* Room info overlay */}
      <div className="absolute top-4 left-4 z-10">
        <h2 className="text-white font-display text-2xl drop-shadow-lg">{room.name}</h2>
        <p className="text-gray-400 text-xs mt-1 max-w-xs drop-shadow">{ambientDesc}</p>
      </div>

      {/* Zone hotspots */}
      <div className="absolute inset-0">
        {zones.map((zone: any) => {
          const zoneId = getId.zone(zone);
          const pos = getPosition(zone);
          // Always allow clicking zones — even "non-interactable" zones should
          // be explorable so players don't feel stuck
          const interactable = true;
          const hasZoomView = true;

          const currentStateId = gameState.zoneStates[zoneId] ?? zone.default_state ?? zone.defaultState;
          const zoneState = (zone.states ?? []).find(
            (s: any) => (s.state_id ?? s.stateId) === currentStateId
          );

          const zoneObjectIds: string[] = zone.contains ?? [];
          const visibleObjects = zoneObjectIds.filter((oid: string) =>
            gameState.objectsInWorld.includes(oid)
          );

          return (
            <button
              key={zoneId}
              onClick={() => interactable && hasZoomView && onZoomInto(zoneId)}
              disabled={!interactable}
              className={`absolute zone-interactable border rounded-lg transition-all group ${
                interactable
                  ? "border-white/10 hover:border-iris-400/50 cursor-inspect bg-white/[0.02] hover:bg-white/[0.06]"
                  : "border-transparent cursor-default"
              }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${pos.width}%`,
                height: `${pos.height}%`,
              }}
              title={zone.name}
            >
              {/* Sprite overlays for objects in this zone */}
              {visibleObjects.length > 0 && (
                <div className="absolute bottom-8 left-1 right-1 flex gap-1 justify-center">
                  {visibleObjects.slice(0, 3).map((oid: string) => {
                    const obj = allObjects.find((o: any) => getId.object(o) === oid);
                    const name = obj?.name ?? oid;
                    const size = obj?.asset_tags?.includes("large") ? "large" as const :
                                 obj?.asset_tags?.includes("small") ? "small" as const : "small" as const;
                    return (
                      <SpriteOverlay
                        key={oid}
                        objectId={oid}
                        name={name}
                        lighting={lighting}
                        size={size}
                      />
                    );
                  })}
                </div>
              )}

              {/* Zone label on hover */}
              <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-void-900/80 backdrop-blur rounded px-2 py-1">
                  <div className="text-white text-xs font-medium truncate">
                    {zone.name}
                  </div>
                  {zoneState?.description && (
                    <div className="text-gray-400 text-[10px] truncate">
                      {zoneState.description}
                    </div>
                  )}
                  {visibleObjects.length > 0 && (
                    <div className="text-amber-400 text-[10px]">
                      {visibleObjects.length} object{visibleObjects.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>

              {/* Indicator dot */}
              {visibleObjects.length > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse-slow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Room transitions */}
      {transitions.map((tr: any, i: number) => {
        const toRoomId = tr.to_room_id ?? tr.toRoomId;
        const requires = tr.requires;
        const pos = getPosition(tr);
        const isUnlocked =
          gameState.transitionsUnlocked.includes(toRoomId) ||
          toRoomId === getId.room(rooms[0]);

        if (requires && !isUnlocked) return null;

        const targetRoom = rooms.find((r: any) => getId.room(r) === toRoomId);
        const targetName = targetRoom?.name ?? "Unknown";

        return (
          <button
            key={`tr-${i}`}
            onClick={() => onMoveToRoom(toRoomId)}
            className="absolute border-2 border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition-all cursor-pointer group"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${pos.width}%`,
              height: `${pos.height}%`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-void-900/80 backdrop-blur rounded px-2 py-1 text-center opacity-70 group-hover:opacity-100 transition-opacity">
                <div className="text-emerald-400 text-xs font-mono">Go to</div>
                <div className="text-white text-sm">{targetName}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Handles progressive loading: procedural bg → fade in DALL-E image */
function BackgroundLayer({
  roomId,
  theme,
  lighting,
}: {
  roomId: string;
  theme: string;
  lighting: string;
}) {
  const backgroundUrl = useAssetStore((s) => s.backgrounds[roomId]);
  const [bgLoaded, setBgLoaded] = useState(false);

  // Reset when room changes
  useEffect(() => setBgLoaded(false), [roomId]);

  return (
    <>
      {/* DALL-E background image */}
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          onLoad={() => setBgLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            bgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Procedural fallback (fades out when image loads) */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          bgLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <ProceduralBackground theme={theme} lighting={lighting} />
      </div>
    </>
  );
}
