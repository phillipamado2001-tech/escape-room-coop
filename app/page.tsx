"use client";

import { useState, useEffect } from "react";
import { THEMES, DURATION_OPTIONS, DIFFICULTY_SETTINGS } from "@shared/constants";
import type { Difficulty, Theme } from "@shared/types";
import { useSocket } from "@client/hooks/use-socket";
import { useGameStore } from "@client/store/game-store";
import { GameView } from "@client/components/GameView";

export default function Home() {
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<Theme>("doctor_office");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [duration, setDuration] = useState(30);
  const [joinCode, setJoinCode] = useState("");

  const socket = useSocket();
  const connected = useGameStore((s) => s.connected);
  const gameState = useGameStore((s) => s.gameState);
  const escapeRoom = useGameStore((s) => s.escapeRoom);
  const generationProgress = useGameStore((s) => s.generationProgress);
  const generationError = useGameStore((s) => s.generationError);
  const playerId = useGameStore((s) => s.playerId);
  const sessionId = useGameStore((s) => s.sessionId);
  const setPlayerId = useGameStore((s) => s.setPlayerId);
  const setSessionId = useGameStore((s) => s.setSessionId);

  const selectedDuration =
    DURATION_OPTIONS.find((d) => d.minutes === duration) || DURATION_OPTIONS[1];

  const isInGame =
    gameState &&
    (gameState.status === "playing" ||
      gameState.status === "paused" ||
      gameState.status === "completed" ||
      gameState.status === "failed");

  // Check if we're attempting reconnection
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("escaperoom_session");
      if (saved && !gameState) {
        setIsReconnecting(true);
        const timer = setTimeout(() => setIsReconnecting(false), 5000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gameState) setIsReconnecting(false);
  }, [gameState]);

  // --- Handlers ---
  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    setPlayerId("player_1");
    socket.createRoom({
      theme: selectedTheme,
      difficulty,
      targetDurationMinutes: duration,
      roomCount: selectedDuration.rooms,
      playerCount: 2,
      playerName: playerName.trim(),
    });
    setMode("menu"); // Will be overridden by gameState updates
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || joinCode.length < 4) return;
    setPlayerId("player_2");
    setSessionId(joinCode);
    socket.joinRoom(joinCode, playerName.trim());
  };

  const handleStartGame = () => {
    socket.startGame();
  };

  // --- Render game view when playing ---
  if (isInGame) {
    return (
      <GameView
        actions={{
          moveToRoom: socket.moveToRoom,
          zoomInto: socket.zoomInto,
          zoomOut: socket.zoomOut,
          pickUpObject: socket.pickUpObject,
          inspectObject: socket.inspectObject,
          combineObjects: socket.combineObjects,
          useObject: socket.useObject,
          attemptPuzzle: socket.attemptPuzzle,
          requestHint: socket.requestHint,
          coopConfirm: socket.coopConfirm,
          coopReject: socket.coopReject,
          sendChat: socket.sendChat,
          pauseGame: socket.pauseGame,
          resumeGame: socket.resumeGame,
          offerObject: socket.offerObject,
        }}
      />
    );
  }

  // --- Lobby states ---
  const isGenerating = gameState?.status === "generating";
  const isLobby = gameState?.status === "lobby";
  const hasRoom = !!escapeRoom;
  const bothConnected =
    gameState?.players.every((p) => p.connected) ?? false;
  const roomCode = gameState?.sessionId ?? sessionId;

  // Show waiting/generating screen if we have a game state
  if (gameState) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">
          <h1 className="font-display text-5xl text-white mb-2">
            Escape Room
          </h1>

          {/* Generating state */}
          {isGenerating && (
            <div className="mt-8 space-y-4">
              <div className="w-12 h-12 mx-auto border-2 border-iris-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-iris-400 font-mono text-sm">
                Generating your escape room...
              </p>
              {generationProgress && (
                <p className="text-gray-500 text-xs">{generationProgress}</p>
              )}
            </div>
          )}

          {/* Error */}
          {generationError && (
            <div className="mt-8 p-4 bg-scarlet-400/10 border border-scarlet-400/30 rounded-lg">
              <p className="text-scarlet-400 text-sm">{generationError}</p>
            </div>
          )}

          {/* Lobby — room generated, waiting for players */}
          {isLobby && (
            <div className="mt-8 space-y-6">
              {/* Room code */}
              {roomCode && (
                <div>
                  <p className="text-gray-500 text-sm mb-2">
                    Share this code with your partner:
                  </p>
                  <div className="inline-block px-6 py-3 bg-void-700 border border-iris-400/40 rounded-xl">
                    <span className="font-mono text-3xl text-white tracking-[0.3em]">
                      {roomCode}
                    </span>
                  </div>
                </div>
              )}

              {/* Player status */}
              <div className="space-y-2">
                {gameState.players.map((p, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      p.connected
                        ? "border-emerald-400/30 bg-emerald-400/5"
                        : "border-void-500 bg-void-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          p.connected ? "bg-emerald-400" : "bg-gray-600"
                        }`}
                      />
                      <span
                        className={
                          p.connected ? "text-white text-sm" : "text-gray-500 text-sm"
                        }
                      >
                        {p.displayName || `Player ${i + 1}`}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-gray-500">
                      {p.connected ? "Connected" : "Waiting..."}
                    </span>
                  </div>
                ))}
              </div>

              {/* Room info */}
              {hasRoom && (
                <div className="text-gray-500 text-xs space-y-1">
                  <p>
                    Theme:{" "}
                    {THEMES.find((t) => t.id === escapeRoom!.config?.theme)?.name ??
                      escapeRoom!.config?.theme}
                  </p>
                  <p>
                    Puzzles: {escapeRoom!.puzzles?.length ?? "?"} | Rooms:{" "}
                    {escapeRoom!.rooms?.length ?? "?"}
                  </p>
                </div>
              )}

              {/* Start button — host only */}
              {playerId === "player_1" ? (
                <button
                  onClick={handleStartGame}
                  disabled={!bothConnected || !hasRoom}
                  className="w-full p-4 bg-gradient-to-r from-emerald-400 to-green-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {!hasRoom
                    ? "Waiting for room generation..."
                    : !bothConnected
                    ? "Waiting for partner..."
                    : "Start Game"}
                </button>
              ) : (
                <div className="w-full p-4 text-center text-gray-400 text-sm border border-void-500 rounded-xl">
                  Waiting for host to start the game...
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  // --- Initial lobby UI ---
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="font-display text-5xl text-white mb-2">
            Escape Room
          </h1>
          <p className="text-gray-500 text-lg">
            AI-generated cooperative puzzles
          </p>
          {!connected && (
            <p className="text-amber-400 text-xs mt-2 font-mono">
              Connecting to server...
            </p>
          )}
        </div>

        {/* Reconnecting state */}
        {isReconnecting && !gameState && (
          <div className="text-center mb-8">
            <div className="w-8 h-8 mx-auto border-2 border-iris-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-iris-400 text-sm font-mono">Reconnecting to session...</p>
            <button
              onClick={() => {
                setIsReconnecting(false);
                try { sessionStorage.removeItem("escaperoom_session"); } catch {}
              }}
              className="text-gray-500 hover:text-white text-xs mt-2"
            >
              Cancel and start fresh
            </button>
          </div>
        )}

        {/* Main Menu */}
        {mode === "menu" && !isReconnecting && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("create")}
              disabled={!connected}
              className="w-full p-6 bg-void-600 hover:bg-void-500 border border-void-500 hover:border-iris-400 rounded-xl transition-all text-left disabled:opacity-40"
            >
              <div className="text-xl font-bold text-white mb-1">
                Create Room
              </div>
              <div className="text-gray-400 text-sm">
                Set up a new escape room and invite a partner
              </div>
            </button>
            <button
              onClick={() => setMode("join")}
              disabled={!connected}
              className="w-full p-6 bg-void-600 hover:bg-void-500 border border-void-500 hover:border-emerald-400 rounded-xl transition-all text-left disabled:opacity-40"
            >
              <div className="text-xl font-bold text-white mb-1">
                Join Room
              </div>
              <div className="text-gray-400 text-sm">
                Enter a room code to join your partner
              </div>
            </button>
          </div>
        )}

        {/* Create Room */}
        {mode === "create" && (
          <div className="space-y-6">
            <button
              onClick={() => setMode("menu")}
              className="text-gray-500 hover:text-white text-sm"
            >
              ← Back
            </button>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-3 bg-void-700 border border-void-500 rounded-lg text-white placeholder-gray-600 focus:border-iris-400 focus:outline-none"
              />
            </div>

            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Theme
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedTheme === theme.id
                        ? "bg-iris-400/10 border-iris-400 text-white"
                        : "bg-void-700 border-void-500 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {theme.icon} {theme.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {theme.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Difficulty
              </label>
              <div className="flex gap-2">
                {(
                  Object.entries(DIFFICULTY_SETTINGS) as [
                    Difficulty,
                    (typeof DIFFICULTY_SETTINGS)[Difficulty]
                  ][]
                ).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setDifficulty(key)}
                    className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                      difficulty === key
                        ? "bg-iris-400/10 border-iris-400 text-white"
                        : "bg-void-700 border-void-500 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-sm font-medium">{val.label}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {DIFFICULTY_SETTINGS[difficulty].description}
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Duration
              </label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    onClick={() => setDuration(opt.minutes)}
                    className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                      duration === opt.minutes
                        ? "bg-iris-400/10 border-iris-400 text-white"
                        : "bg-void-700 border-void-500 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-sm font-medium">{opt.minutes}m</div>
                    <div className="text-xs text-gray-500">
                      {opt.rooms} room{opt.rooms > 1 ? "s" : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateRoom}
              disabled={!playerName.trim() || !connected}
              className="w-full p-4 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate Escape Room
            </button>
          </div>
        )}

        {/* Join Room */}
        {mode === "join" && (
          <div className="space-y-6">
            <button
              onClick={() => setMode("menu")}
              className="text-gray-500 hover:text-white text-sm"
            >
              ← Back
            </button>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-3 bg-void-700 border border-void-500 rounded-lg text-white placeholder-gray-600 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter 8-character room code"
                maxLength={8}
                className="w-full p-3 bg-void-700 border border-void-500 rounded-lg text-white placeholder-gray-600 focus:border-emerald-400 focus:outline-none font-mono text-center text-2xl tracking-widest"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={!playerName.trim() || joinCode.length < 4 || !connected}
              className="w-full p-4 bg-gradient-to-r from-emerald-400 to-green-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
