"use client";

import { useState, useCallback } from "react";
import type { SequenceConfig } from "@shared/types";

interface Props {
  config: SequenceConfig;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onClose: () => void;
}

export function SequenceSelector({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  onAttempt,
  onRequestHint,
  onClose,
}: Props) {
  const elements = config.elements || [];
  const [ordered, setOrdered] = useState<string[]>([]);
  const [pool, setPool] = useState<string[]>([...elements]);

  const addToSequence = useCallback((item: string) => {
    setPool((p) => p.filter((x) => x !== item));
    setOrdered((o) => [...o, item]);
  }, []);

  const removeFromSequence = useCallback((index: number) => {
    setOrdered((o) => {
      const removed = o[index];
      setPool((p) => [...p, removed]);
      return o.filter((_, i) => i !== index);
    });
  }, []);

  const resetOrder = () => {
    setPool([...elements]);
    setOrdered([]);
  };

  const handleSubmit = () => {
    if (ordered.length !== elements.length) return;
    onAttempt(puzzleId, ordered);
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-md w-full">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
        {(config.orderLogic ?? (config as any).order_logic) && (
          <p className="text-gray-600 text-xs mt-1">
            {config.orderLogic ?? (config as any).order_logic}
          </p>
        )}
      </div>

      {/* Current sequence */}
      <div className="w-full">
        <div className="text-gray-500 text-xs font-mono uppercase mb-2">
          Your Sequence ({ordered.length}/{elements.length})
        </div>
        <div className="min-h-[3rem] p-2 bg-void-800 border border-void-500 rounded-lg flex flex-wrap gap-2">
          {ordered.length === 0 && (
            <span className="text-gray-600 text-xs p-1">
              Click items below to order them...
            </span>
          )}
          {ordered.map((item, i) => (
            <button
              key={`${item}-${i}`}
              onClick={() => removeFromSequence(i)}
              className="px-3 py-1.5 bg-iris-400/20 border border-iris-400/40 rounded text-iris-400 text-sm hover:bg-iris-400/30 transition-colors"
            >
              <span className="text-gray-500 text-xs mr-1">{i + 1}.</span>
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Available pool */}
      {pool.length > 0 && (
        <div className="w-full">
          <div className="text-gray-500 text-xs font-mono uppercase mb-2">
            Available Items
          </div>
          <div className="flex flex-wrap gap-2">
            {pool.map((item) => (
              <button
                key={item}
                onClick={() => addToSequence(item)}
                className="px-3 py-1.5 bg-void-600 border border-void-500 rounded text-gray-300 text-sm hover:border-iris-400 hover:text-white transition-colors"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 w-full">
        <button
          onClick={handleSubmit}
          disabled={ordered.length !== elements.length}
          className="flex-1 py-2 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-40"
        >
          Submit Order
        </button>
        <button
          onClick={resetOrder}
          className="px-3 py-2 bg-void-600 border border-void-500 text-gray-400 rounded-lg hover:bg-void-500 text-sm"
        >
          Reset
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
