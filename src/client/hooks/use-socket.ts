import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents, SessionConfig } from "@shared/types";
import { useGameStore } from "@client/store/game-store";
import { useAssetStore } from "@client/store/asset-store";
import { audio } from "@client/lib/audio";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const store = useGameStore();

  useEffect(() => {
    const socket: GameSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      store.setConnected(true);
      console.log("🔌 Connected to server");

      // Attempt reconnection from sessionStorage
      try {
        const saved = sessionStorage.getItem("escaperoom_session");
        if (saved) {
          const { sessionId, playerId, token } = JSON.parse(saved);
          if (sessionId && playerId && token) {
            console.log("🔄 Attempting reconnection...");
            socket.emit("rejoinSession", { sessionId, playerId, token });
          }
        }
      } catch {}
    });

    socket.on("disconnect", () => {
      store.setConnected(false);
      console.log("🔌 Disconnected from server");
    });

    // Game state sync
    socket.on("gameState", (state) => {
      store.setGameState(state);
    });

    // Session data (generated room)
    socket.on("sessionData", (session) => {
      store.setEscapeRoom(session);
      store.setGenerationProgress(null);
    });

    // Generation progress
    socket.on("generationProgress", (msg) => {
      store.setGenerationProgress(msg);
    });

    socket.on("generationError", (err) => {
      store.setGenerationError(err);
    });

    // Player events
    socket.on("playerJoined", (player) => {
      store.addNotification("info", "Player Joined", `${player.displayName} has joined the room`);
    });

    socket.on("playerLeft", (playerId) => {
      store.addNotification("info", "Player Left", `${playerId} has disconnected`);
    });

    // Object events
    socket.on("objectPickedUp", ({ playerId, objectId }) => {
      audio.pickup();
      useGameStore.getState().addNotification("info", "Object Picked Up", `${playerId} picked up an item.`);
    });

    socket.on("objectInspected", ({ playerId, objectId, inspection }) => {
      useGameStore.getState().showInspection(objectId, inspection);
    });

    socket.on("objectsCombined", ({ playerId, objectA, objectB, result, description }) => {
      useGameStore.getState().addNotification("info", "Objects Combined", description);
    });

    socket.on("objectUsed", ({ playerId, objectId, target, effect }) => {
      useGameStore.getState().addNotification("info", "Object Used", effect);
    });

    // Puzzle events
    socket.on("puzzleAttempted", ({ playerId, puzzleId, correct }) => {
      const s = useGameStore.getState();
      s.setPuzzleResult({ puzzleId, correct, timestamp: Date.now() });
      if (!correct) {
        audio.wrong();
        s.addNotification("error", "Incorrect", "That's not right. Keep trying.");
      } else {
        audio.correct();
      }
      // Auto-clear result after animation
      setTimeout(() => useGameStore.getState().setPuzzleResult(null), 1200);
    });

    socket.on("puzzleSolved", ({ playerId, puzzleId, narrative, rewards }) => {
      const myId = useGameStore.getState().playerId;
      if (playerId !== myId) {
        audio.partnerSolve();
      }
      store.addNotification("solve", "Puzzle Solved!", narrative);
      store.showNarrative("Puzzle Solved", narrative);
    });

    // Hints
    socket.on("hintDelivered", ({ puzzleId, hint }) => {
      audio.hint();
      store.showHint(puzzleId, hint);
    });

    // Story
    socket.on("storyBeatRevealed", ({ beatId, text }) => {
      store.showNarrative("Discovery", text);
    });

    // Zone/transition changes
    socket.on("zoneStateChanged", ({ zoneId, newState }) => {
      useGameStore.getState().addNotification("info", "Something Changed", "The environment has shifted...");
    });

    socket.on("transitionUnlocked", ({ roomId }) => {
      audio.transition();
      useGameStore.getState().addNotification("info", "Path Unlocked", "A new area has been revealed.");
    });

    // Timer
    socket.on("timerUpdate", ({ elapsed, remaining }) => {
      if (remaining === 60 || remaining === 30) {
        audio.timerWarning();
      }
    });

    // Game end
    socket.on("gameCompleted", ({ totalTime, hintsUsed }) => {
      audio.victory();
      const minutes = Math.floor(totalTime / 60);
      const seconds = totalTime % 60;
      store.addNotification("solve", "Escaped!",
        `Completed in ${minutes}m ${seconds}s with ${hintsUsed} hint${hintsUsed !== 1 ? "s" : ""} used.`
      );
      // Clear reconnection data — game is over
      try { sessionStorage.removeItem("escaperoom_session"); } catch {}
    });

    socket.on("gameFailed", ({ reason }) => {
      audio.failure();
      store.addNotification("error", "Time's Up", reason);
      try { sessionStorage.removeItem("escaperoom_session"); } catch {}
    });

    // Assets
    socket.on("assetReady", ({ type, id, url }) => {
      const fullUrl = `${SOCKET_URL}${url}`;
      useAssetStore.getState().setAsset(type, id, fullUrl);
    });

    // Reconnection
    socket.on("rejoinSuccess", ({ playerId, sessionId, token }) => {
      const s = useGameStore.getState();
      s.setPlayerId(playerId);
      s.setSessionId(sessionId);
      s.setReconnectToken(token);
      // Save reconnection data to sessionStorage for page refresh survival
      try {
        sessionStorage.setItem("escaperoom_session", JSON.stringify({ sessionId, playerId, token }));
      } catch {}
      console.log(`✅ Rejoined as ${playerId} in session ${sessionId}`);
    });

    socket.on("rejoinFailed", ({ reason }) => {
      console.log(`❌ Rejoin failed: ${reason}`);
      // Clear stale session data
      sessionStorage.removeItem("escaperoom_session");
    });

    // Co-op sequential confirm
    socket.on("coopConfirmRequested", ({ playerId: fromPlayer, puzzleId, action, answer }) => {
      const myId = useGameStore.getState().playerId;
      if (fromPlayer !== myId) {
        // I'm P2 — show confirm/reject UI
        audio.chatPing();
        useGameStore.getState().setCoopConfirm({ puzzleId, fromPlayer, action, answer });
        useGameStore.getState().addNotification("info", "Co-op Confirm", `Your partner submitted an answer. Review and confirm!`);
      }
    });

    socket.on("coopConfirmAccepted", ({ playerId, puzzleId }) => {
      useGameStore.getState().setCoopConfirm(null);
    });

    socket.on("coopConfirmRejected", ({ playerId, puzzleId }) => {
      useGameStore.getState().setCoopConfirm(null);
      useGameStore.getState().addNotification("error", "Rejected", "Your partner rejected the answer. Try again.");
    });

    // Object trading
    socket.on("objectOffered", ({ fromPlayer, objectId, objectName }) => {
      const myId = useGameStore.getState().playerId;
      if (fromPlayer !== myId) {
        audio.chatPing();
        useGameStore.getState().addNotification(
          "info",
          "Item Offered",
          `${fromPlayer} wants to give you: ${objectName}. Open inventory to accept.`
        );
      }
    });

    socket.on("objectTraded", ({ fromPlayer, toPlayer, objectId }) => {
      audio.pickup();
      const myId = useGameStore.getState().playerId;
      if (toPlayer === myId) {
        useGameStore.getState().addNotification("info", "Item Received", `You received an item from ${fromPlayer}.`);
      } else if (fromPlayer === myId) {
        useGameStore.getState().addNotification("info", "Item Sent", `Item sent to ${toPlayer}.`);
      }
    });

    // Chat
    socket.on("chatMessage", (msg) => {
      const myId = useGameStore.getState().playerId;
      if (msg.playerId !== myId) {
        audio.chatPing();
      }
      store.addChatMessage(msg);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Action emitters
  const createRoom = useCallback((config: SessionConfig & { playerName: string }) => {
    socketRef.current?.emit("createRoom", config);
  }, []);

  const joinRoom = useCallback((sessionId: string, playerName: string) => {
    socketRef.current?.emit("joinRoom", { sessionId, playerName });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit("startGame");
  }, []);

  const moveToRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("moveToRoom", roomId);
  }, []);

  const zoomInto = useCallback((zoneId: string) => {
    socketRef.current?.emit("zoomInto", zoneId);
  }, []);

  const zoomOut = useCallback(() => {
    socketRef.current?.emit("zoomOut");
  }, []);

  const pickUpObject = useCallback((objectId: string) => {
    socketRef.current?.emit("pickUpObject", objectId);
  }, []);

  const inspectObject = useCallback((objectId: string) => {
    socketRef.current?.emit("inspectObject", objectId);
  }, []);

  const combineObjects = useCallback((a: string, b: string) => {
    socketRef.current?.emit("combineObjects", a, b);
  }, []);

  const useObject = useCallback((objectId: string, targetZoneId: string) => {
    socketRef.current?.emit("useObject", objectId, targetZoneId);
  }, []);

  const attemptPuzzle = useCallback((puzzleId: string, answer: unknown) => {
    socketRef.current?.emit("attemptPuzzle", puzzleId, answer);
  }, []);

  const requestHint = useCallback((puzzleId: string) => {
    socketRef.current?.emit("requestHint", puzzleId);
  }, []);

  const coopConfirm = useCallback((puzzleId: string) => {
    socketRef.current?.emit("coopConfirm", puzzleId);
  }, []);

  const coopReject = useCallback((puzzleId: string) => {
    socketRef.current?.emit("coopReject", puzzleId);
  }, []);

  const sendChat = useCallback((message: string) => {
    socketRef.current?.emit("sendChat", message);
  }, []);

  const pauseGame = useCallback(() => {
    socketRef.current?.emit("pauseGame");
  }, []);

  const resumeGame = useCallback(() => {
    socketRef.current?.emit("resumeGame");
  }, []);

  const offerObject = useCallback((objectId: string) => {
    socketRef.current?.emit("offerObject", objectId);
  }, []);

  const acceptObject = useCallback((objectId: string, fromPlayerId: "player_1" | "player_2") => {
    socketRef.current?.emit("acceptObject", objectId, fromPlayerId);
  }, []);

  return {
    createRoom, joinRoom, startGame,
    moveToRoom, zoomInto, zoomOut,
    pickUpObject, inspectObject, combineObjects, useObject,
    attemptPuzzle, requestHint, coopConfirm, coopReject,
    sendChat, pauseGame, resumeGame,
    offerObject, acceptObject,
  };
}
