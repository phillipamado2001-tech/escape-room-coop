"use client";

import { useEffect } from "react";
import { useGameStore } from "@client/store/game-store";

export function Notifications() {
  const notifications = useGameStore((s) => s.notifications);
  const dismiss = useGameStore((s) => s.dismissNotification);

  // Auto-dismiss each notification after 4 seconds
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((n) =>
      setTimeout(() => dismiss(n.id), 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, dismiss]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => {
        const borderColor =
          n.type === "solve"
            ? "border-emerald-400"
            : n.type === "error"
            ? "border-scarlet-400"
            : n.type === "hint"
            ? "border-amber-400"
            : "border-iris-400";

        return (
          <div
            key={n.id}
            className={`bg-void-700 border ${borderColor} rounded-lg p-3 shadow-lg narrative-reveal`}
          >
            <div className="flex justify-between items-start">
              <div className="text-white text-sm font-medium">{n.title}</div>
              <button
                onClick={() => dismiss(n.id)}
                className="text-gray-500 hover:text-white text-xs ml-2"
              >
                x
              </button>
            </div>
            <div className="text-gray-400 text-xs mt-1">{n.text}</div>
          </div>
        );
      })}
    </div>
  );
}
