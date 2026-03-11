"use client";

import { useState } from "react";
import type { CipherConfig } from "@shared/types";

interface Props {
  config: CipherConfig;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onClose: () => void;
}

export function CipherInput({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  onAttempt,
  onRequestHint,
  onClose,
}: Props) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (!answer.trim()) return;
    onAttempt(puzzleId, answer.trim());
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-md w-full">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
      </div>

      {/* Encrypted text display */}
      <div className="w-full p-4 bg-void-800 border border-void-500 rounded-lg">
        <div className="text-gray-600 text-xs font-mono uppercase mb-2">
          Encrypted Message
        </div>
        <p className="text-iris-400 font-mono text-center text-lg tracking-wider">
          {config.encryptedText ?? (config as any).encrypted_text ?? "???"}
        </p>
        <div className="text-gray-600 text-xs font-mono mt-2 text-center">
          Method: {config.method}
        </div>
      </div>

      {/* Key location hint */}
      {(config.keyLocation ?? (config as any).key_location) && (
        <div className="text-gray-500 text-xs text-center italic">
          The key can be found: {config.keyLocation ?? (config as any).key_location}
        </div>
      )}

      {/* Answer input */}
      <div className="w-full">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Enter decrypted message..."
          className="w-full p-3 bg-void-700 border border-void-500 rounded-lg text-white placeholder-gray-600 focus:border-iris-400 focus:outline-none font-mono text-center"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 w-full">
        <button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className="flex-1 py-2 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-40 focus-ring"
        >
          Decode
        </button>
        <button
          onClick={() => onRequestHint(puzzleId)}
          className="px-3 py-2 bg-void-600 border border-amber-400/30 text-amber-400 rounded-lg hover:bg-void-500 text-sm focus-ring"
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
