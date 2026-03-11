import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents, PlayerId } from "@shared/types";
import { gameSessionStore } from "../services/session-store";
import { generateEscapeRoom } from "../services/generation";
import { generateHint } from "../services/hints";
import { startAssetPipeline } from "../services/asset-pipeline";
import { cleanupSessionAssets } from "../services/asset-cache";
import { GAME_CONSTANTS } from "@shared/constants";
import { sanitizeText, isValidString, isValidId, RateLimiter, RATE_LIMITS } from "../lib/validation";

type GameIO = Server<ClientToServerEvents, ServerToClientEvents>;

// Shared rate limiter instance
const rateLimiter = new RateLimiter();

// Cleanup old rate limit entries every 60s
setInterval(() => rateLimiter.cleanup(), 60000);

export function setupSocketHandlers(io: GameIO) {
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    let currentSessionId: string | null = null;
    let currentPlayerId: PlayerId | null = null;
    let isGenerating = false;

    // Per-session per-puzzle hint counts
    const puzzleHintCounts = new Map<string, number>();

    // Helper: check if game is actively playing
    function getActiveSession() {
      if (!currentSessionId || !currentPlayerId) return null;
      const session = gameSessionStore.get(currentSessionId);
      if (!session || session.gameState.status !== "playing") return null;
      return session;
    }

    // --- CREATE ROOM ---
    socket.on("createRoom", async (config) => {
      if (isGenerating) return; // Prevent double-creation
      isGenerating = true;

      const { playerName, ...sessionConfig } = config;
      const session = gameSessionStore.create(sessionConfig, playerName);
      currentSessionId = session.id;
      currentPlayerId = "player_1";
      session.socketMap.set(socket.id, "player_1");

      socket.join(session.id);
      socket.emit("gameState", session.gameState);

      // Send reconnection token to the host
      const hostToken = gameSessionStore.getReconnectToken(session.id, "player_1");
      if (hostToken) {
        socket.emit("rejoinSuccess", { playerId: "player_1", sessionId: session.id, token: hostToken });
      }

      console.log(`🎮 Room ${session.id} created by ${playerName}`);

      // Start generation immediately
      session.gameState.status = "generating";
      io.to(session.id).emit("gameState", session.gameState);

      try {
        const escapeRoom = await generateEscapeRoom(
          sessionConfig,
          undefined,
          {
            onProgress: (msg) => {
              io.to(session.id).emit("generationProgress", msg);
            },
            onError: (err) => {
              io.to(session.id).emit("generationError", err);
            },
          }
        );

        gameSessionStore.initializeFromGeneration(session.id, escapeRoom);
        session.gameState.status = "lobby";
        io.to(session.id).emit("sessionData", escapeRoom);
        io.to(session.id).emit("gameState", session.gameState);
        console.log(`✅ Room ${session.id} generated successfully`);

        // Fire-and-forget asset generation in background
        const assetReqs = (escapeRoom as any).asset_requirements || escapeRoom.assetRequirements;
        if (assetReqs) {
          startAssetPipeline(session.id, assetReqs, (data) => {
            session.completedAssets.set(`${data.type}:${data.id}`, data);
            io.to(session.id).emit("assetReady", data);
          }).catch((err) => console.error(`Asset pipeline error for ${session.id}:`, err));
        }
      } catch (error: any) {
        session.gameState.status = "lobby";
        io.to(session.id).emit("generationError", error.message);
        io.to(session.id).emit("gameState", session.gameState);
      } finally {
        isGenerating = false;
      }
    });

    // --- REJOIN SESSION (reconnection) ---
    socket.on("rejoinSession", ({ sessionId, playerId, token }) => {
      if (!isValidString(sessionId, 16) || !isValidString(token, 32)) {
        socket.emit("rejoinFailed", { reason: "Invalid reconnection data" });
        return;
      }
      if (playerId !== "player_1" && playerId !== "player_2") {
        socket.emit("rejoinFailed", { reason: "Invalid player ID" });
        return;
      }

      if (!gameSessionStore.validateReconnect(sessionId, playerId, token)) {
        socket.emit("rejoinFailed", { reason: "Session expired or invalid token" });
        return;
      }

      const session = gameSessionStore.get(sessionId);
      if (!session) {
        socket.emit("rejoinFailed", { reason: "Session no longer exists" });
        return;
      }

      // Cancel pending cleanup
      gameSessionStore.cancelCleanup(sessionId);

      // Set up socket state
      currentSessionId = sessionId;
      currentPlayerId = playerId;
      session.socketMap.set(socket.id, playerId);

      const playerIdx = playerId === "player_1" ? 0 : 1;
      session.gameState.players[playerIdx].connected = true;

      socket.join(sessionId);

      // Send full state to reconnecting client
      if (session.escapeRoom) {
        socket.emit("sessionData", session.escapeRoom);
      }
      for (const asset of session.completedAssets.values()) {
        socket.emit("assetReady", asset);
      }

      socket.emit("rejoinSuccess", { playerId, sessionId, token });
      io.to(sessionId).emit("gameState", session.gameState);
      io.to(sessionId).emit("playerJoined", session.gameState.players[playerIdx]);

      console.log(`🔄 ${playerId} rejoined session ${sessionId}`);
    });

    // --- JOIN ROOM ---
    socket.on("joinRoom", ({ sessionId, playerName }) => {
      const session = gameSessionStore.get(sessionId);
      if (!session) {
        socket.emit("generationError", "Session not found");
        return;
      }

      if (session.gameState.players[1].connected) {
        socket.emit("generationError", "Room is full");
        return;
      }

      currentSessionId = sessionId;
      currentPlayerId = "player_2";
      session.socketMap.set(socket.id, "player_2");
      session.gameState.players[1].displayName = playerName;
      session.gameState.players[1].connected = true;

      socket.join(sessionId);

      // Send the session data if already generated
      if (session.escapeRoom) {
        socket.emit("sessionData", session.escapeRoom);
      }

      // Replay already-completed assets for the joining player
      for (const asset of session.completedAssets.values()) {
        socket.emit("assetReady", asset);
      }

      io.to(sessionId).emit("gameState", session.gameState);
      io.to(sessionId).emit("playerJoined", session.gameState.players[1]);

      // Send reconnection token to P2
      const p2Token = gameSessionStore.getReconnectToken(sessionId, "player_2");
      if (p2Token) {
        socket.emit("rejoinSuccess", { playerId: "player_2", sessionId, token: p2Token });
      }

      console.log(`👥 ${playerName} joined room ${sessionId}`);
    });

    // --- START GAME ---
    socket.on("startGame", () => {
      if (!currentSessionId || currentPlayerId !== "player_1") return; // Host only
      const session = gameSessionStore.get(currentSessionId);
      if (!session || !session.escapeRoom) return;
      if (session.gameState.status !== "lobby") return;

      // Both players must be connected
      if (!session.gameState.players.every(p => p.connected)) {
        socket.emit("generationError", "Both players must be connected to start");
        return;
      }

      gameSessionStore.startTimer(currentSessionId, (elapsed, remaining) => {
        io.to(currentSessionId!).emit("timerUpdate", { elapsed, remaining });

        if (remaining <= 0) {
          io.to(currentSessionId!).emit("gameFailed", { reason: "Time expired" });
          io.to(currentSessionId!).emit("gameState", session.gameState);
        }
      });

      // Emit initial story beat if it exists
      const narrative = (session.escapeRoom as any).narrative;
      const firstBeat = narrative?.story_beats?.find((b: any) => b.order === 1 && !b.revealed_by);
      if (firstBeat) {
        session.gameState.storyBeatsRevealed.push(firstBeat.id);
        io.to(currentSessionId).emit("storyBeatRevealed", { beatId: firstBeat.id, text: firstBeat.text });
      }

      io.to(currentSessionId).emit("gameState", session.gameState);
      console.log(`🚀 Game started in room ${currentSessionId}`);
    });

    // --- ACTIVATE PUZZLE (open puzzle UI without attempting) ---
    socket.on("attemptPuzzle", (puzzleId, answer) => {
      if (!currentSessionId || !currentPlayerId) return;
      if (!isValidString(puzzleId, 64)) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session || !session.escapeRoom) return;
      if (session.gameState.status !== "playing") return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;

      // If answer is null, this is just activating/opening the puzzle UI
      if (answer === null || answer === undefined) {
        session.gameState.players[playerIdx].activePuzzle = puzzleId;
        io.to(currentSessionId).emit("gameState", session.gameState);
        return;
      }

      // Rate limit puzzle attempts
      const attemptKey = `attempt:${socket.id}`;
      if (!rateLimiter.isAllowed(attemptKey, RATE_LIMITS.PUZZLE_ATTEMPT.windowMs, RATE_LIMITS.PUZZLE_ATTEMPT.maxActions)) return;

      // Already solved? Ignore
      if (session.gameState.puzzlesSolved.includes(puzzleId)) return;
      if (!session.gameState.puzzlesAvailable.includes(puzzleId)) return;

      const puzzles = session.escapeRoom.puzzles || [];
      const puzzle = puzzles.find((p: any) => (p.puzzle_id || p.puzzleId) === puzzleId);
      if (!puzzle) return;

      // Check required objects
      const reqObjs = (puzzle as any).requires_objects || puzzle.requiresObjects || [];
      if (reqObjs.length > 0) {
        const allPlayerInvs = session.gameState.players.flatMap(p => p.inventory);
        if (!reqObjs.every((oid: string) => allPlayerInvs.includes(oid))) {
          socket.emit("puzzleAttempted", { playerId: currentPlayerId!, puzzleId, correct: false });
          return;
        }
      }

      const config = puzzle.config as any;
      const coopInfo = puzzle.coop ?? (puzzle as any).coop_info;
      const coopMode = coopInfo?.mode;

      // --- Sequential Confirm: P1 submits, P2 must confirm ---
      if (coopMode === "sequential_confirm") {
        if (currentPlayerId === "player_1") {
          // P1 submits — hold answer and request P2 confirmation
          session.pendingCoopConfirms.set(puzzleId, {
            puzzleId,
            fromPlayer: "player_1",
            answer,
            timestamp: Date.now(),
          });
          const actionDesc = coopInfo?.collaborationHint ?? (coopInfo as any)?.collaboration_hint ?? "Confirm partner's answer";
          io.to(currentSessionId).emit("coopConfirmRequested", {
            playerId: "player_1",
            puzzleId,
            action: actionDesc,
            answer,
          });
          return; // Don't check answer yet
        }
        // If P2 tries to submit directly on a sequential_confirm, ignore
        // (P2 should use coopConfirm/coopReject)
        return;
      }

      let correct = false;

      // Detect mislabeled puzzle types and normalize aliases
      let puzzleType = config.type;
      if (puzzleType === "combination_lock" && (config.pattern_elements || config.patternElements)) {
        puzzleType = "pattern";
      }
      if (config.encrypted_text || config.encryptedText) {
        puzzleType = "cipher";
      }
      // Opus sometimes uses "matching" instead of "symbol_match"
      if (puzzleType === "matching") {
        puzzleType = "symbol_match";
      }
      // "riddle" or "search" → treat as generic text answer
      if (puzzleType === "riddle" || puzzleType === "search" || puzzleType === "word_puzzle") {
        puzzleType = "cipher"; // same logic: compare text answers
      }

      // Check answer based on puzzle type
      switch (puzzleType) {
        case "combination_lock":
          correct = String(answer) === String(config.solution);
          break;
        case "cipher":
          correct = String(answer).toLowerCase().trim() === String(config.solution).toLowerCase().trim();
          break;
        case "sequence":
          correct = JSON.stringify(answer) === JSON.stringify(config.correct_order || config.correctOrder);
          break;
        case "pattern":
          correct = String(answer).toLowerCase().trim() === String(config.answer ?? config.solution).toLowerCase().trim();
          break;
        case "symbol_match":
        case "drag_arrange": {
          const expectedMap = config.correct_mapping || config.correctMapping || config.correct_order || config.correctOrder;
          if (Array.isArray(expectedMap) && Array.isArray(answer)) {
            correct = JSON.stringify(answer) === JSON.stringify(expectedMap);
          } else if (typeof expectedMap === "object" && typeof answer === "object") {
            correct = JSON.stringify(answer) === JSON.stringify(expectedMap);
          } else {
            // Fallback: compare as strings for text-based answers
            correct = String(answer).toLowerCase().trim() === String(expectedMap).toLowerCase().trim();
          }
          break;
        }
        case "wiring": {
          const expected = config.correct_connections || config.correctConnections || [];
          const submitted = Array.isArray(answer) ? answer : [];
          const normalizePairs = (arr: any[]) =>
            arr.map((pair: any) => (Array.isArray(pair) ? [...pair].sort().join(":") : String(pair))).sort();
          correct = JSON.stringify(normalizePairs(submitted)) === JSON.stringify(normalizePairs(expected));
          break;
        }
        case "observation":
        case "inventory_use":
          // These are solved by actions, not answers
          correct = true;
          break;
        default: {
          // Unknown puzzle types — try matching against config.solution or config.answer as text
          const expectedAnswer = config.solution ?? config.answer;
          if (expectedAnswer !== undefined && expectedAnswer !== null) {
            correct = String(answer).toLowerCase().trim() === String(expectedAnswer).toLowerCase().trim();
          } else {
            // No solution defined — can't validate, don't auto-solve
            correct = false;
          }
          break;
        }
      }

      io.to(currentSessionId).emit("puzzleAttempted", { playerId: currentPlayerId, puzzleId, correct });

      if (correct) {
        const rewards = gameSessionStore.solvePuzzle(currentSessionId, puzzleId);
        if (rewards) {
          // Add granted objects directly to the solving player's inventory
          for (const objId of rewards.objectsGranted) {
            if (!session.gameState.players[playerIdx].inventory.includes(objId)) {
              session.gameState.players[playerIdx].inventory.push(objId);
            }
          }

          io.to(currentSessionId).emit("puzzleSolved", {
            playerId: currentPlayerId,
            puzzleId,
            narrative: (puzzle as any)?.solve_narrative || puzzle?.solveNarrative || "",
            rewards,
          });

          // Emit zone changes
          for (const change of rewards.zonesChanged) {
            io.to(currentSessionId).emit("zoneStateChanged", {
              zoneId: (change as any).zone_id || (change as any).zoneId,
              newState: (change as any).new_state || (change as any).newState,
            });
          }

          // Emit transition unlocks
          for (const roomId of rewards.transitionsUnlocked) {
            io.to(currentSessionId).emit("transitionUnlocked", { roomId });
          }

          // Emit story beat
          if (rewards.narrativeBeat) {
            const narrative = (session.escapeRoom as any).narrative;
            const beat = narrative?.story_beats?.find((b: any) => b.id === rewards.narrativeBeat);
            if (beat) {
              io.to(currentSessionId).emit("storyBeatRevealed", { beatId: beat.id, text: beat.text });
            }
          }

          // Clear active puzzle after solving
          session.gameState.players[playerIdx].activePuzzle = null;

          // Check game completion (solvePuzzle mutates status to "completed")
          if ((session.gameState.status as string) === "completed") {
            io.to(currentSessionId).emit("gameCompleted", {
              totalTime: session.gameState.elapsedSeconds,
              hintsUsed: session.gameState.hintsUsed,
            });
          }
        }

        io.to(currentSessionId).emit("gameState", session.gameState);
      }
    });

    // --- CLEAR ACTIVE PUZZLE (back to zone view without zooming out) ---
    socket.on("zoomOut", () => {
      if (!currentSessionId || !currentPlayerId) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session) return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;
      const player = session.gameState.players[playerIdx];

      // If we have an active puzzle, just close it (return to zone view)
      if (player.activePuzzle) {
        player.activePuzzle = null;
        io.to(currentSessionId).emit("gameState", session.gameState);
        return;
      }

      // Otherwise zoom out to room view
      player.currentView = "room";
      player.zoomTarget = null;
      io.to(currentSessionId).emit("gameState", session.gameState);
    });

    // --- ROOM NAVIGATION ---
    socket.on("moveToRoom", (roomId) => {
      if (!isValidString(roomId, 64)) return;
      const session = getActiveSession();
      if (!session) return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;

      // Check if transition is unlocked
      if (!session.gameState.transitionsUnlocked.includes(roomId)) {
        const rooms = session.escapeRoom?.rooms || [];
        const firstRoomId = (rooms[0] as any)?.room_id || rooms[0]?.roomId;
        if (roomId !== firstRoomId) return;
      }

      session.gameState.players[playerIdx].currentRoom = roomId;
      session.gameState.players[playerIdx].currentView = "room";
      session.gameState.players[playerIdx].zoomTarget = null;
      session.gameState.players[playerIdx].activePuzzle = null;

      io.to(currentSessionId!).emit("gameState", session.gameState);
    });

    // --- ZOOM ---
    socket.on("zoomInto", (zoneId) => {
      if (!isValidString(zoneId, 64)) return;
      const session = getActiveSession();
      if (!session) return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;
      session.gameState.players[playerIdx].currentView = "zoom";
      session.gameState.players[playerIdx].zoomTarget = zoneId;

      io.to(currentSessionId!).emit("gameState", session.gameState);
    });

    // --- OBJECT INTERACTIONS ---
    socket.on("pickUpObject", (objectId) => {
      if (!isValidString(objectId, 64)) return;
      const session = getActiveSession();
      if (!session || !session.escapeRoom) return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;
      const objects = session.escapeRoom.objects || [];
      const obj = objects.find((o: any) => (o.object_id || o.objectId) === objectId);
      if (!obj) return;

      // Check visibility
      const visibility = (obj as any).player_visibility || obj.playerVisibility || "both";
      if (visibility !== "both" && visibility !== currentPlayerId) return;

      // Check if object is portable (not environmental or red_herring)
      const category = (obj as any).category ?? (obj as any).object_category ?? "environmental";
      if (category === "environmental" || category === "red_herring") {
        // Non-portable objects can only be inspected, not picked up
        return;
      }

      // Check object is actually in the world (not already picked up)
      if (!session.gameState.objectsInWorld.includes(objectId)) return;

      // Remove from world, add to inventory
      session.gameState.objectsInWorld = session.gameState.objectsInWorld.filter(id => id !== objectId);
      if (!session.gameState.players[playerIdx].inventory.includes(objectId)) {
        session.gameState.players[playerIdx].inventory.push(objectId);
      }

      io.to(currentSessionId!).emit("objectPickedUp", { playerId: currentPlayerId!, objectId });
      io.to(currentSessionId!).emit("gameState", session.gameState);
    });

    socket.on("inspectObject", (objectId) => {
      if (!isValidString(objectId, 64)) return;
      if (!currentSessionId || !currentPlayerId) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session || !session.escapeRoom) return;

      const objects = session.escapeRoom.objects || [];
      const obj = objects.find((o: any) => (o.object_id || o.objectId) === objectId);
      if (!obj) return;

      const inspection = obj.inspection || {};
      // Only send inspection to the requesting player (preserves asymmetric info)
      socket.emit("objectInspected", {
        playerId: currentPlayerId,
        objectId,
        inspection: {
          description: inspection.description || "",
          clueText: (inspection as any).clue_text || inspection.clueText || null,
        },
      });
    });

    socket.on("combineObjects", (objectA, objectB) => {
      const session = getActiveSession();
      if (!session || !session.escapeRoom) return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;
      const inventory = session.gameState.players[playerIdx].inventory;

      // Verify both objects are in the player's inventory
      if (!inventory.includes(objectA) || !inventory.includes(objectB)) return;

      const objects = session.escapeRoom.objects || [];
      const objA = objects.find((o: any) => (o.object_id || o.objectId) === objectA);
      if (!objA) return;

      const combo = (objA.combinations || []).find((c: any) =>
        (c.combine_with || c.combineWith) === objectB
      );

      if (!combo) {
        socket.emit("puzzleAttempted", { playerId: currentPlayerId!, puzzleId: "", correct: false });
        return;
      }

      const resultId = combo.produces;

      // Remove components, add result
      session.gameState.players[playerIdx].inventory = session.gameState.players[playerIdx].inventory.filter(
        id => id !== objectA && id !== objectB
      );
      session.gameState.players[playerIdx].inventory.push(resultId);

      io.to(currentSessionId!).emit("objectsCombined", {
        playerId: currentPlayerId!,
        objectA,
        objectB,
        result: resultId,
        description: combo.description || "",
      });
      io.to(currentSessionId!).emit("gameState", session.gameState);
    });

    socket.on("useObject", (objectId, targetZoneId) => {
      const session = getActiveSession();
      if (!session || !session.escapeRoom) return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;

      // Verify the object is in the player's inventory
      if (!session.gameState.players[playerIdx].inventory.includes(objectId)) return;

      const objects = session.escapeRoom.objects || [];
      const obj = objects.find((o: any) => (o.object_id || o.objectId) === objectId);
      if (!obj) return;

      const usage = ((obj as any).usable_on || obj.usableOn || []).find((u: any) =>
        (u.target_zone_id || u.targetZoneId) === targetZoneId
      );

      if (!usage) {
        socket.emit("puzzleAttempted", { playerId: currentPlayerId!, puzzleId: "", correct: false });
        return;
      }

      const triggeredPuzzle = usage.triggers;
      if (triggeredPuzzle) {
        const rewards = gameSessionStore.solvePuzzle(currentSessionId!, triggeredPuzzle);
        if (rewards) {
          const puzzle = (session.escapeRoom.puzzles || []).find(
            (p: any) => (p.puzzle_id || p.puzzleId) === triggeredPuzzle
          );
          io.to(currentSessionId!).emit("puzzleSolved", {
            playerId: currentPlayerId!,
            puzzleId: triggeredPuzzle,
            narrative: (puzzle as any)?.solve_narrative || puzzle?.solveNarrative || "",
            rewards,
          });

          // Emit all reward events (same as attemptPuzzle)
          for (const change of rewards.zonesChanged) {
            io.to(currentSessionId!).emit("zoneStateChanged", {
              zoneId: (change as any).zone_id || (change as any).zoneId,
              newState: (change as any).new_state || (change as any).newState,
            });
          }
          for (const roomId of rewards.transitionsUnlocked) {
            io.to(currentSessionId!).emit("transitionUnlocked", { roomId });
          }
          if (rewards.narrativeBeat) {
            const narr = (session.escapeRoom as any).narrative;
            const beat = narr?.story_beats?.find((b: any) => b.id === rewards.narrativeBeat);
            if (beat) {
              io.to(currentSessionId!).emit("storyBeatRevealed", { beatId: beat.id, text: beat.text });
            }
          }
          if ((session.gameState.status as string) === "completed") {
            io.to(currentSessionId!).emit("gameCompleted", {
              totalTime: session.gameState.elapsedSeconds,
              hintsUsed: session.gameState.hintsUsed,
            });
          }
        }
      }

      io.to(currentSessionId!).emit("objectUsed", {
        playerId: currentPlayerId!,
        objectId,
        target: targetZoneId,
        effect: usage.effect || "",
      });
      io.to(currentSessionId!).emit("gameState", session.gameState);
    });

    // --- HINTS ---
    socket.on("requestHint", async (puzzleId) => {
      if (!currentSessionId || !currentPlayerId) return;
      if (!isValidString(puzzleId, 64)) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session || !session.escapeRoom) return;
      if (session.gameState.status !== "playing") return;

      // Rate limit hints
      const hintKey = `hint:${socket.id}`;
      if (!rateLimiter.isAllowed(hintKey, RATE_LIMITS.HINT.windowMs, RATE_LIMITS.HINT.maxActions)) {
        socket.emit("generationError", "Please wait before requesting another hint.");
        return;
      }

      if (session.gameState.hintsRemaining <= 0) {
        socket.emit("generationError", "No hints remaining");
        return;
      }

      const puzzles = session.escapeRoom.puzzles || [];
      const puzzle = puzzles.find((p: any) => (p.puzzle_id || p.puzzleId) === puzzleId);
      if (!puzzle) return;

      // Per-puzzle hint tier
      const puzzleHints = puzzleHintCounts.get(puzzleId) ?? 0;
      const tier = Math.min(3, puzzleHints + 1) as 1 | 2 | 3;

      // Consume hint first, but save state to revert on failure
      session.gameState.hintsUsed++;
      session.gameState.hintsRemaining--;
      puzzleHintCounts.set(puzzleId, puzzleHints + 1);

      const existingHints = puzzle.hints || [];

      try {
        const hintText = await generateHint(
          puzzle.name,
          puzzle.type,
          (puzzle as any).flavor_text || puzzle.flavorText || "",
          puzzle.config,
          existingHints,
          session.gameState.puzzlesSolved,
          session.gameState.players.flatMap(p => p.inventory),
          tier
        );

        io.to(currentSessionId).emit("hintDelivered", {
          puzzleId,
          hint: { tier, text: hintText },
        });
        io.to(currentSessionId).emit("gameState", session.gameState);
      } catch (err: any) {
        // Revert hint consumption on failure
        session.gameState.hintsUsed--;
        session.gameState.hintsRemaining++;
        puzzleHintCounts.set(puzzleId, puzzleHints);
        socket.emit("generationError", "Failed to generate hint. Hint not consumed.");
      }
    });

    // --- CO-OP CONFIRM (P2 confirms P1's sequential_confirm answer) ---
    socket.on("coopConfirm", (puzzleId) => {
      if (!currentSessionId || !currentPlayerId) return;
      if (!isValidString(puzzleId, 64)) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session || !session.escapeRoom) return;

      const pending = session.pendingCoopConfirms.get(puzzleId);
      if (!pending) {
        // No pending confirmation — just emit generic accept
        io.to(currentSessionId).emit("coopConfirmAccepted", {
          playerId: currentPlayerId,
          puzzleId,
        });
        return;
      }

      // P2 confirmed — now actually check the answer
      session.pendingCoopConfirms.delete(puzzleId);

      // Re-run the answer check with the held answer
      const puzzles = session.escapeRoom.puzzles || [];
      const puzzle = puzzles.find((p: any) => (p.puzzle_id || p.puzzleId) === puzzleId);
      if (!puzzle) return;

      const config = puzzle.config as any;
      let correct = false;
      let puzzleType = config.type;
      if (puzzleType === "combination_lock" && (config.pattern_elements || config.patternElements)) puzzleType = "pattern";
      if (config.encrypted_text || config.encryptedText) puzzleType = "cipher";
      if (puzzleType === "matching") puzzleType = "symbol_match";
      if (puzzleType === "riddle" || puzzleType === "search" || puzzleType === "word_puzzle") puzzleType = "cipher";

      const answer = pending.answer;
      switch (puzzleType) {
        case "combination_lock":
          correct = String(answer) === String(config.solution);
          break;
        case "cipher":
          correct = String(answer).toLowerCase().trim() === String(config.solution).toLowerCase().trim();
          break;
        case "sequence":
          correct = JSON.stringify(answer) === JSON.stringify(config.correct_order || config.correctOrder);
          break;
        case "pattern":
          correct = String(answer).toLowerCase().trim() === String(config.answer ?? config.solution).toLowerCase().trim();
          break;
        case "symbol_match":
        case "drag_arrange": {
          const expectedMap = config.correct_mapping || config.correctMapping || config.correct_order || config.correctOrder;
          if (Array.isArray(expectedMap) && Array.isArray(answer)) {
            correct = JSON.stringify(answer) === JSON.stringify(expectedMap);
          } else if (typeof expectedMap === "object" && typeof answer === "object") {
            correct = JSON.stringify(answer) === JSON.stringify(expectedMap);
          } else {
            correct = String(answer).toLowerCase().trim() === String(expectedMap).toLowerCase().trim();
          }
          break;
        }
        case "wiring": {
          const expected = config.correct_connections || config.correctConnections || [];
          const submitted = Array.isArray(answer) ? answer : [];
          const normPairs = (arr: any[]) =>
            arr.map((pair: any) => (Array.isArray(pair) ? [...pair].sort().join(":") : String(pair))).sort();
          correct = JSON.stringify(normPairs(submitted)) === JSON.stringify(normPairs(expected));
          break;
        }
        case "observation":
        case "inventory_use":
          correct = true;
          break;
        default: {
          const expectedAnswer = config.solution ?? config.answer;
          correct = expectedAnswer != null
            ? String(answer).toLowerCase().trim() === String(expectedAnswer).toLowerCase().trim()
            : false;
          break;
        }
      }

      // Emit result to both players
      io.to(currentSessionId).emit("coopConfirmAccepted", { playerId: currentPlayerId, puzzleId });
      io.to(currentSessionId).emit("puzzleAttempted", { playerId: pending.fromPlayer, puzzleId, correct });

      if (correct) {
        const fromIdx = pending.fromPlayer === "player_1" ? 0 : 1;
        const rewards = gameSessionStore.solvePuzzle(currentSessionId, puzzleId);
        if (rewards) {
          for (const objId of rewards.objectsGranted) {
            if (!session.gameState.players[fromIdx].inventory.includes(objId)) {
              session.gameState.players[fromIdx].inventory.push(objId);
            }
          }
          io.to(currentSessionId).emit("puzzleSolved", {
            playerId: pending.fromPlayer,
            puzzleId,
            narrative: (puzzle as any)?.solve_narrative || puzzle?.solveNarrative || "",
            rewards,
          });
          for (const change of rewards.zonesChanged) {
            io.to(currentSessionId).emit("zoneStateChanged", {
              zoneId: (change as any).zone_id || (change as any).zoneId,
              newState: (change as any).new_state || (change as any).newState,
            });
          }
          for (const roomId of rewards.transitionsUnlocked) {
            io.to(currentSessionId).emit("transitionUnlocked", { roomId });
          }
          if (rewards.narrativeBeat) {
            const narr = (session.escapeRoom as any).narrative;
            const beat = narr?.story_beats?.find((b: any) => b.id === rewards.narrativeBeat);
            if (beat) {
              io.to(currentSessionId).emit("storyBeatRevealed", { beatId: beat.id, text: beat.text });
            }
          }
          session.gameState.players[fromIdx].activePuzzle = null;
          if ((session.gameState.status as string) === "completed") {
            io.to(currentSessionId).emit("gameCompleted", {
              totalTime: session.gameState.elapsedSeconds,
              hintsUsed: session.gameState.hintsUsed,
            });
          }
        }
        io.to(currentSessionId).emit("gameState", session.gameState);
      }
    });

    // --- CO-OP REJECT (P2 rejects P1's sequential_confirm answer) ---
    socket.on("coopReject", (puzzleId) => {
      if (!currentSessionId || !currentPlayerId) return;
      if (!isValidString(puzzleId, 64)) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session) return;

      const pending = session.pendingCoopConfirms.get(puzzleId);
      if (!pending) return;

      session.pendingCoopConfirms.delete(puzzleId);

      io.to(currentSessionId).emit("coopConfirmRejected", {
        playerId: currentPlayerId,
        puzzleId,
      });
      // Also signal incorrect to the submitter so they get feedback
      io.to(currentSessionId).emit("puzzleAttempted", {
        playerId: pending.fromPlayer,
        puzzleId,
        correct: false,
      });
    });

    // --- OBJECT TRADING ---
    socket.on("offerObject", (objectId) => {
      if (!currentSessionId || !currentPlayerId) return;
      if (!isValidString(objectId, 64)) return;
      const session = getActiveSession();
      if (!session || !session.escapeRoom) return;

      const playerIdx = currentPlayerId === "player_1" ? 0 : 1;
      const inventory = session.gameState.players[playerIdx].inventory;
      if (!inventory.includes(objectId)) return;

      const objects = session.escapeRoom.objects || [];
      const obj = objects.find((o: any) => (o.object_id || o.objectId) === objectId);
      const objName = obj?.name ?? objectId;

      io.to(currentSessionId).emit("objectOffered", {
        fromPlayer: currentPlayerId,
        objectId,
        objectName: objName,
      });
    });

    socket.on("acceptObject", (objectId, fromPlayerId) => {
      if (!currentSessionId || !currentPlayerId) return;
      if (!isValidString(objectId, 64)) return;
      if (fromPlayerId !== "player_1" && fromPlayerId !== "player_2") return;
      if (fromPlayerId === currentPlayerId) return; // Can't accept from yourself

      const session = getActiveSession();
      if (!session) return;

      const fromIdx = fromPlayerId === "player_1" ? 0 : 1;
      const toIdx = currentPlayerId === "player_1" ? 0 : 1;

      const fromInv = session.gameState.players[fromIdx].inventory;
      if (!fromInv.includes(objectId)) return;

      // Transfer the object
      session.gameState.players[fromIdx].inventory = fromInv.filter(id => id !== objectId);
      if (!session.gameState.players[toIdx].inventory.includes(objectId)) {
        session.gameState.players[toIdx].inventory.push(objectId);
      }

      io.to(currentSessionId).emit("objectTraded", {
        fromPlayer: fromPlayerId,
        toPlayer: currentPlayerId,
        objectId,
      });
      io.to(currentSessionId).emit("gameState", session.gameState);
    });

    // --- CHAT ---
    socket.on("sendChat", (message) => {
      if (!currentSessionId || !currentPlayerId) return;
      if (!isValidString(message, GAME_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH)) return;

      // Rate limit chat
      const chatKey = `chat:${socket.id}`;
      if (!rateLimiter.isAllowed(chatKey, RATE_LIMITS.CHAT.windowMs, RATE_LIMITS.CHAT.maxActions)) return;

      io.to(currentSessionId).emit("chatMessage", {
        playerId: currentPlayerId,
        message: sanitizeText(message.substring(0, GAME_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH)),
        timestamp: Date.now(),
      });
    });

    // --- PAUSE/RESUME ---
    socket.on("pauseGame", () => {
      if (!currentSessionId) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session || session.gameState.status !== "playing") return;
      session.gameState.status = "paused";
      if (session.timerInterval) clearInterval(session.timerInterval);
      session.timerInterval = null;
      io.to(currentSessionId).emit("gameState", session.gameState);
    });

    socket.on("resumeGame", () => {
      if (!currentSessionId) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session || session.gameState.status !== "paused") return;
      gameSessionStore.startTimer(currentSessionId, (elapsed, remaining) => {
        io.to(currentSessionId!).emit("timerUpdate", { elapsed, remaining });
        if (remaining <= 0) {
          io.to(currentSessionId!).emit("gameFailed", { reason: "Time expired" });
          io.to(currentSessionId!).emit("gameState", session.gameState);
        }
      }, false); // Don't reset elapsed time on resume
      io.to(currentSessionId).emit("gameState", session.gameState);
    });

    // --- DISCONNECT ---
    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      if (!currentSessionId) return;
      const session = gameSessionStore.get(currentSessionId);
      if (!session) return;

      session.socketMap.delete(socket.id);
      if (currentPlayerId) {
        const playerIdx = currentPlayerId === "player_1" ? 0 : 1;
        session.gameState.players[playerIdx].connected = false;
        io.to(currentSessionId).emit("playerLeft", currentPlayerId);
        io.to(currentSessionId).emit("gameState", session.gameState);

        // If game is playing/paused, pause the timer so reconnecting player isn't penalized
        if (session.gameState.status === "playing") {
          session.gameState.status = "paused";
          if (session.timerInterval) clearInterval(session.timerInterval);
          session.timerInterval = null;
          io.to(currentSessionId).emit("gameState", session.gameState);
        }
      }

      // Schedule cleanup after 5min if both players are gone
      const sessId = currentSessionId;
      gameSessionStore.scheduleCleanup(sessId, () => {
        console.log(`🗑️ Cleaning up empty session ${sessId} (5min timeout)`);
        cleanupSessionAssets(sessId);
      });
    });
  });
}
