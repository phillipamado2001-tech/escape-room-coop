"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Game error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-void-900 p-8">
      <div className="max-w-md w-full text-center">
        <div className="text-scarlet-400 text-6xl mb-4">!</div>
        <h2 className="text-white font-display text-2xl mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          An unexpected error occurred. Your game session may still be active.
        </p>
        {error.message && (
          <div className="mb-6 p-3 bg-void-800 border border-void-600 rounded-lg">
            <p className="text-gray-500 text-xs font-mono break-all">
              {error.message}
            </p>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-void-600 border border-void-500 text-gray-300 rounded-lg hover:bg-void-500 transition-colors"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
