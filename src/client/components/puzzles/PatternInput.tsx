"use client";

import { useState } from "react";
import type { PatternConfig } from "@shared/types";

interface Props {
  config: PatternConfig;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onClose: () => void;
}

export function PatternInput({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  onAttempt,
  onRequestHint,
  onClose,
}: Props) {
  const [answer, setAnswer] = useState("");

  const elements =
    config.patternElements ?? (config as any).pattern_elements ?? [];
  // solution_logic is NOT displayed — it would give away the answer

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

      {/* Pattern display */}
      <div className="w-full p-4 bg-void-800 border border-void-500 rounded-lg">
        <div className="text-gray-600 text-xs font-mono uppercase mb-2">
          Pattern
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {elements.map((el: string, i: number) => (
            <div
              key={i}
              className="px-3 py-2 bg-void-600 border border-iris-400/30 rounded text-iris-400 font-mono text-lg"
            >
              {el}
            </div>
          ))}
          <div className="px-3 py-2 bg-void-600 border border-amber-400/30 rounded text-amber-400 font-mono text-lg">
            ?
          </div>
        </div>
      </div>

      {/* Answer */}
      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="What comes next?"
        className="w-full p-3 bg-void-700 border border-void-500 rounded-lg text-white placeholder-gray-600 focus:border-iris-400 focus:outline-none font-mono text-center"
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

      <button onClick={onClose} className="text-gray-500 hover:text-white text-xs focus-ring rounded px-2 py-1">
        Back
      </button>
    </div>
  );
}
