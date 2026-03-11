import type { Express } from "express";
import { gameSessionStore } from "../services/session-store";

export function setupRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  app.get("/api/sessions", (_req, res) => {
    const sessions = gameSessionStore.listJoinable();
    res.json({ sessions });
  });

  app.get("/api/sessions/:id", (req, res) => {
    const session = gameSessionStore.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ session: { id: session.id, status: session.gameState.status, playerCount: session.gameState.players.filter((p: any) => p.connected).length } });
  });

  // List ALL sessions (debug)
  app.get("/api/debug-all", (_req, res) => {
    const all = (gameSessionStore as any).sessions as Map<string, any>;
    const list: any[] = [];
    for (const [id, session] of all) {
      list.push({ id, status: session.gameState.status, players: session.gameState.players.map((p: any) => ({ id: p.playerId, connected: p.connected, room: p.currentRoom })) });
    }
    res.json({ sessions: list });
  });

  // Check if a session is still alive (for reconnection probing)
  app.get("/api/sessions/:id/alive", (req, res) => {
    const session = gameSessionStore.get(req.params.id);
    if (!session) return res.status(404).json({ alive: false });
    res.json({
      alive: true,
      status: session.gameState.status,
      players: session.gameState.players.map((p: any) => ({
        id: p.playerId,
        connected: p.connected,
      })),
    });
  });

  // Debug endpoint — dump full session data
  app.get("/api/debug/:id", (req, res) => {
    const session = gameSessionStore.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({
      gameState: session.gameState,
      rooms: (session.escapeRoom as any)?.rooms?.map((r: any) => ({
        id: r.room_id || r.roomId,
        name: r.name,
        zones: (r.zones || []).map((z: any) => ({
          id: z.zone_id || z.zoneId,
          name: z.name,
          interactable: z.interactable,
          zoomView: z.zoom_view ?? z.zoomView,
          contains: z.contains,
          position: z.position,
        })),
      })),
      puzzles: (session.escapeRoom as any)?.puzzles?.map((p: any) => ({
        id: p.puzzle_id || p.puzzleId,
        name: p.name,
        type: p.config?.type || p.type,
        roomId: p.room_id || p.roomId,
        requires: p.requires,
        available: session.gameState.puzzlesAvailable.includes(p.puzzle_id || p.puzzleId),
        solved: session.gameState.puzzlesSolved.includes(p.puzzle_id || p.puzzleId),
      })),
      objects: (session.escapeRoom as any)?.objects?.map((o: any) => ({
        id: o.object_id || o.objectId,
        name: o.name,
        zoneId: o.location?.zone_id || o.location?.zoneId,
        visible: o.location?.initially_visible ?? o.location?.initiallyVisible,
        inWorld: session.gameState.objectsInWorld.includes(o.object_id || o.objectId),
      })),
      graph: (session.escapeRoom as any)?.dependency_graph || (session.escapeRoom as any)?.dependencyGraph,
    });
  });
}
