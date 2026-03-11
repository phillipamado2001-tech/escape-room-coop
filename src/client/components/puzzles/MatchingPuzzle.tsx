"use client";

import { useState, useCallback } from "react";

interface Props {
  config: any;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  puzzleType: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onClose: () => void;
}

export function MatchingPuzzle({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  puzzleType,
  onAttempt,
  onRequestHint,
  onClose,
}: Props) {
  // Extract items depending on puzzle type
  const pairs = config.pairs || [];
  const items = config.items || config.elements || [];
  const targetSlots = config.target_slots || config.targetSlots || [];

  // For symbol_match: pair symbols from two lists
  // For drag_arrange: assign items to slots
  const leftItems =
    puzzleType === "symbol_match"
      ? pairs.map((p: any) => p.symbol_a ?? p.symbolA ?? p.left ?? p[0])
      : items;

  const rightItems =
    puzzleType === "symbol_match"
      ? pairs.map((p: any) => p.symbol_b ?? p.symbolB ?? p.right ?? p[1])
      : targetSlots.length > 0
      ? targetSlots
      : items.map((_: any, i: number) => `Slot ${i + 1}`);

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const handleLeftClick = useCallback((item: string) => {
    setSelectedLeft((prev) => (prev === item ? null : item));
  }, []);

  const handleRightClick = useCallback(
    (item: string) => {
      if (!selectedLeft) return;
      setMapping((prev) => {
        const next = { ...prev };
        // Remove any existing mapping for this left item
        next[selectedLeft] = item;
        return next;
      });
      setSelectedLeft(null);
    },
    [selectedLeft]
  );

  const removeMapping = useCallback((leftItem: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[leftItem];
      return next;
    });
  }, []);

  const handleSubmit = () => {
    // Send as ordered array of pairs for compatibility with server
    const answer = leftItems.map((left: string) => [left, mapping[left] || ""]);
    onAttempt(puzzleId, answer);
  };

  const allMapped = leftItems.every((l: string) => mapping[l]);

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg w-full">
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
        <p className="text-gray-600 text-xs mt-1 font-mono">
          {puzzleType === "symbol_match" ? "Match each symbol to its pair" : "Arrange items into the correct slots"}
        </p>
      </div>

      <div className="w-full grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          <div className="text-gray-500 text-xs font-mono uppercase mb-1">Items</div>
          {leftItems.map((item: string, i: number) => {
            const isSelected = selectedLeft === item;
            const isMapped = !!mapping[item];
            return (
              <button
                key={`left-${i}`}
                onClick={() => (isMapped ? removeMapping(item) : handleLeftClick(item))}
                className={`w-full p-2 rounded-lg border text-sm text-left transition-all ${
                  isSelected
                    ? "bg-iris-400/20 border-iris-400 text-iris-400"
                    : isMapped
                    ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
                    : "bg-void-700 border-void-500 text-gray-300 hover:border-gray-400"
                }`}
              >
                {item}
                {isMapped && (
                  <span className="text-xs ml-2 text-gray-500">→ {mapping[item]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <div className="text-gray-500 text-xs font-mono uppercase mb-1">
            {puzzleType === "symbol_match" ? "Matches" : "Slots"}
          </div>
          {rightItems.map((item: string, i: number) => {
            const isTarget = Object.values(mapping).includes(item);
            return (
              <button
                key={`right-${i}`}
                onClick={() => handleRightClick(item)}
                disabled={!selectedLeft}
                className={`w-full p-2 rounded-lg border text-sm text-left transition-all ${
                  isTarget
                    ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
                    : selectedLeft
                    ? "bg-void-600 border-amber-400/30 text-gray-300 hover:border-amber-400 cursor-pointer"
                    : "bg-void-700 border-void-500 text-gray-400"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {selectedLeft && (
        <p className="text-amber-400 text-xs">Select a match for: {selectedLeft}</p>
      )}

      <div className="flex gap-2 w-full">
        <button
          onClick={handleSubmit}
          disabled={!allMapped}
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

      <button onClick={onClose} className="text-gray-500 hover:text-white text-xs focus-ring rounded px-2 py-1">
        Back
      </button>
    </div>
  );
}
