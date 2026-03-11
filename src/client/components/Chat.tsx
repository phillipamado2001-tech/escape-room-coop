"use client";

import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@client/store/game-store";

export function Chat({ onSend }: { onSend: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messages = useGameStore((s) => s.chatMessages);
  const playerId = useGameStore((s) => s.playerId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="fixed bottom-20 right-4 z-30">
      {open ? (
        <div className="w-72 bg-void-800 border border-void-500 rounded-xl overflow-hidden shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-void-600">
            <span className="text-gray-400 text-xs font-mono">Chat</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white text-xs"
            >
              x
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="h-48 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-gray-600 text-xs text-center mt-8">
                No messages yet
              </div>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.playerId === playerId;
              return (
                <div
                  key={i}
                  className={`text-xs ${isMe ? "text-right" : "text-left"}`}
                >
                  <span
                    className={`inline-block px-2 py-1 rounded-lg ${
                      isMe
                        ? "bg-iris-400/20 text-iris-400"
                        : "bg-void-600 text-gray-300"
                    }`}
                  >
                    {msg.message}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-void-600">
            <div className="flex gap-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type..."
                className="flex-1 px-2 py-1 bg-void-700 border border-void-600 rounded text-white text-xs placeholder-gray-600 focus:outline-none focus:border-iris-400"
                maxLength={500}
              />
              <button
                onClick={handleSend}
                className="px-2 py-1 bg-iris-400/20 text-iris-400 rounded text-xs hover:bg-iris-400/30"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 bg-void-700 border border-void-500 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-iris-400 transition-colors focus-ring"
          aria-label="Open chat"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
