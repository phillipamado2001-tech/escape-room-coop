"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@client/store/game-store";

/** Hook: close modal on Escape key */
function useEscapeClose(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, active]);
}

/** Hook: trap focus inside modal */
function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }, [active, ref]);
}

export function InspectionModal() {
  const modal = useGameStore((s) => s.inspectionModal);
  const hide = useGameStore((s) => s.hideInspection);
  const ref = useRef<HTMLDivElement>(null);

  useEscapeClose(hide, !!modal);
  useFocusTrap(ref, !!modal);

  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={hide}
      role="dialog"
      aria-modal="true"
      aria-label="Object inspection"
    >
      <div
        ref={ref}
        className="bg-void-700 border border-void-500 rounded-xl p-6 max-w-md w-full mx-4 narrative-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-iris-400 text-xs font-mono uppercase mb-2">
          Inspection
        </div>
        <p className="text-gray-200 text-sm leading-relaxed">
          {modal.inspection.description}
        </p>
        {modal.inspection.clueText && (
          <div className="mt-3 p-3 bg-void-600 border border-iris-400/30 rounded-lg">
            <div className="text-amber-400 text-xs font-mono mb-1">Clue</div>
            <p className="text-gray-300 text-sm italic">
              {modal.inspection.clueText}
            </p>
          </div>
        )}
        <button
          onClick={hide}
          className="mt-4 w-full py-2 bg-void-600 hover:bg-void-500 border border-void-500 rounded-lg text-gray-300 text-sm focus-ring"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** Typewriter text component */
function TypewriterText({
  text,
  speed = 25,
  onComplete,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
        onComplete?.();
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  const skip = () => {
    setDisplayed(text);
    setDone(true);
    onComplete?.();
  };

  return (
    <div>
      <p className={`text-gray-200 leading-relaxed ${!done ? "typewriter-cursor" : ""}`}>
        {displayed}
      </p>
      {!done && (
        <button
          onClick={skip}
          className="mt-2 text-gray-500 hover:text-gray-300 text-xs underline"
        >
          Skip
        </button>
      )}
    </div>
  );
}

export function NarrativeModal() {
  const modal = useGameStore((s) => s.narrativeModal);
  const hide = useGameStore((s) => s.hideNarrative);
  const ref = useRef<HTMLDivElement>(null);
  const [typewriterDone, setTypewriterDone] = useState(false);

  useEscapeClose(hide, !!modal);
  useFocusTrap(ref, !!modal);

  // Reset typewriter state when modal changes
  useEffect(() => {
    setTypewriterDone(false);
  }, [modal?.text]);

  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={hide}
      role="dialog"
      aria-modal="true"
      aria-label="Narrative"
    >
      <div
        ref={ref}
        className="bg-void-700 border border-emerald-400/30 rounded-xl p-6 max-w-md w-full mx-4 narrative-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-emerald-400 text-xs font-mono uppercase mb-2">
          {modal.title}
        </div>
        <TypewriterText
          text={modal.text}
          speed={25}
          onComplete={() => setTypewriterDone(true)}
        />
        <button
          onClick={hide}
          className="mt-4 w-full py-2 bg-void-600 hover:bg-void-500 border border-void-500 rounded-lg text-gray-300 text-sm focus-ring"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export function HintModal() {
  const hint = useGameStore((s) => s.activeHint);
  const hide = useGameStore((s) => s.hideHint);
  const ref = useRef<HTMLDivElement>(null);

  useEscapeClose(hide, !!hint);
  useFocusTrap(ref, !!hint);

  if (!hint) return null;

  const tierLabel =
    hint.hint.tier === 1
      ? "Gentle Nudge"
      : hint.hint.tier === 2
      ? "Directional Hint"
      : "Strong Hint";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={hide}
      role="dialog"
      aria-modal="true"
      aria-label="Hint"
    >
      <div
        ref={ref}
        className="bg-void-700 border border-amber-400/30 rounded-xl p-6 max-w-md w-full mx-4 narrative-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="text-amber-400 text-xs font-mono uppercase">
            {tierLabel}
          </div>
          <div className="text-gray-600 text-xs">Tier {hint.hint.tier}/3</div>
        </div>
        <p className="text-gray-200 leading-relaxed">{hint.hint.text}</p>
        <button
          onClick={hide}
          className="mt-4 w-full py-2 bg-void-600 hover:bg-void-500 border border-void-500 rounded-lg text-gray-300 text-sm focus-ring"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
