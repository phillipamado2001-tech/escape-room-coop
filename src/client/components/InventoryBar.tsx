"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@client/store/game-store";
import { getObjects, id as getId } from "@client/lib/normalize";

interface Props {
  onInspect: (objectId: string) => void;
  onCombine: (objectA: string, objectB: string) => void;
  onUseObject: (objectId: string, targetZoneId: string) => void;
  onOfferObject?: (objectId: string) => void;
  activeZoneId: string | null;
}

export function InventoryBar({ onInspect, onCombine, onUseObject, onOfferObject, activeZoneId }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const escapeRoom = useGameStore((s) => s.escapeRoom);
  const playerId = useGameStore((s) => s.playerId);
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  if (!gameState || !escapeRoom || !playerId) return null;

  const playerIdx = playerId === "player_1" ? 0 : 1;
  const partner = gameState.players[playerIdx === 0 ? 1 : 0];
  const inventory = gameState.players[playerIdx].inventory;

  // Clear selected item if it's no longer in inventory (consumed by combine/use)
  useEffect(() => {
    if (selected && !inventory.includes(selected)) {
      setSelected(null);
    }
  }, [inventory, selected]);

  if (inventory.length === 0) return null;

  const allObjects = getObjects(escapeRoom);

  const getObjData = (objId: string) =>
    allObjects.find((o: any) => getId.object(o) === objId);

  const handleClick = (objId: string) => {
    if (selected === objId) {
      // Deselect
      setSelected(null);
    } else if (selected) {
      // Combine the two items
      onCombine(selected, objId);
      setSelected(null);
    } else {
      setSelected(objId);
    }
  };

  const handleUse = () => {
    if (selected && activeZoneId) {
      onUseObject(selected, activeZoneId);
      setSelected(null);
    }
  };

  const handleOffer = () => {
    if (selected && onOfferObject) {
      onOfferObject(selected);
      setSelected(null);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-void-900/90 backdrop-blur border-t border-void-500">
      <div className="flex items-center gap-2 px-4 py-2 max-w-7xl mx-auto">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-500 text-xs font-mono mr-1 shrink-0 sm:hidden focus-ring rounded px-1 py-0.5"
          aria-label={collapsed ? "Expand inventory" : "Collapse inventory"}
        >
          {collapsed ? "Inv +" : "Inv -"}
        </button>
        <span className="text-gray-500 text-xs font-mono mr-2 shrink-0 hidden sm:inline">
          Inventory ({inventory.length})
        </span>
        {!collapsed && (
          <div className="flex gap-2 overflow-x-auto py-1">
            {inventory.map((objId) => {
              const obj = getObjData(objId);
              const name = obj?.name ?? objId;
              const isSelected = selected === objId;

              return (
                <button
                  key={objId}
                  onClick={() => handleClick(objId)}
                  onDoubleClick={() => onInspect(objId)}
                  title={`${name} (click to select, double-click to inspect)`}
                  aria-label={`${name}${isSelected ? " (selected)" : ""}`}
                  className={`shrink-0 px-3 py-2 rounded-lg border text-sm transition-all cursor-grab-item focus-ring ${
                    isSelected
                      ? "bg-iris-400/20 border-iris-400 text-iris-400"
                      : "bg-void-600 border-void-500 text-gray-300 hover:border-gray-400"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {/* Use on zone button */}
        {selected && activeZoneId && (
          <button
            onClick={handleUse}
            className="shrink-0 ml-2 px-3 py-2 bg-emerald-400/20 border border-emerald-400/40 text-emerald-400 rounded-lg text-sm hover:bg-emerald-400/30 focus-ring"
          >
            Use on zone
          </button>
        )}

        {/* Offer to partner button */}
        {selected && onOfferObject && partner.connected && (
          <button
            onClick={handleOffer}
            className="shrink-0 ml-1 px-3 py-2 bg-sky-400/20 border border-sky-400/40 text-sky-400 rounded-lg text-sm hover:bg-sky-400/30 focus-ring"
          >
            Offer
          </button>
        )}

        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="shrink-0 ml-1 text-gray-500 hover:text-white text-xs focus-ring rounded px-2 py-1"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
