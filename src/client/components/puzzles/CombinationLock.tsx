"use client";

import { useState, useRef } from "react";
import type { CombinationLockConfig } from "@shared/types";

interface Props {
  config: CombinationLockConfig;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onClose: () => void;
}

export function CombinationLock({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  onAttempt,
  onRequestHint,
  onClose,
}: Props) {
  const digitCount = config.digits || 4;
  const [digits, setDigits] = useState<number[]>(
    Array(digitCount).fill(0)
  );
  const [focusedDigit, setFocusedDigit] = useState(0);
  const digitRefs = useRef<(HTMLDivElement | null)[]>([]);

  const spin = (index: number, direction: 1 | -1) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = (next[index] + direction + 10) % 10;
      return next;
    });
  };

  const handleSubmit = () => {
    const answer = digits.join("");
    onAttempt(puzzleId, answer);
  };

  // Keyboard navigation for digits
  const handleDigitKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        spin(index, 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        spin(index, -1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (index > 0) {
          setFocusedDigit(index - 1);
          digitRefs.current[index - 1]?.focus();
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        if (index < digitCount - 1) {
          setFocusedDigit(index + 1);
          digitRefs.current[index + 1]?.focus();
        }
        break;
      case "Enter":
        e.preventDefault();
        handleSubmit();
        break;
      default:
        // Direct digit input
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          setDigits((prev) => {
            const next = [...prev];
            next[index] = parseInt(e.key);
            return next;
          });
          if (index < digitCount - 1) {
            setFocusedDigit(index + 1);
            digitRefs.current[index + 1]?.focus();
          }
        }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
        {(config.lockStyle ?? (config as any).lock_style) && (
          <p className="text-gray-600 text-xs mt-1">{config.lockStyle ?? (config as any).lock_style}</p>
        )}
      </div>

      {/* Lock */}
      <div className="flex gap-2" role="group" aria-label="Combination lock digits">
        {digits.map((digit, i) => (
          <div key={i} className="flex flex-col items-center">
            <button
              onClick={() => spin(i, 1)}
              className="w-12 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-void-600 rounded-t-lg border border-b-0 border-void-500 transition-colors focus-ring"
              aria-label={`Increment digit ${i + 1}`}
              tabIndex={-1}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
            <div
              ref={(el) => { digitRefs.current[i] = el; }}
              tabIndex={0}
              role="spinbutton"
              aria-label={`Digit ${i + 1}`}
              aria-valuenow={digit}
              aria-valuemin={0}
              aria-valuemax={9}
              onKeyDown={(e) => handleDigitKeyDown(e, i)}
              onFocus={() => setFocusedDigit(i)}
              className={`w-12 h-14 flex items-center justify-center bg-void-800 border text-white font-mono text-2xl font-bold cursor-default focus-ring ${
                focusedDigit === i ? "border-iris-400" : "border-void-500"
              }`}
            >
              {digit}
            </div>
            <button
              onClick={() => spin(i, -1)}
              className="w-12 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-void-600 rounded-b-lg border border-t-0 border-void-500 transition-colors focus-ring"
              aria-label={`Decrement digit ${i + 1}`}
              tabIndex={-1}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <p className="text-gray-600 text-xs">Use arrow keys or type digits</p>

      {/* Actions */}
      <div className="flex gap-2 w-full max-w-xs">
        <button
          onClick={handleSubmit}
          className="flex-1 py-2 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity text-sm focus-ring"
        >
          Unlock
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
