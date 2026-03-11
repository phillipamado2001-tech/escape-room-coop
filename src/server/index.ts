import dotenv from "dotenv";
import { existsSync } from "fs";
dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env" });
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import next from "next";
import type { ServerToClientEvents, ClientToServerEvents } from "@shared/types";
import { setupSocketHandlers } from "./socket/handlers";
import { setupRoutes } from "./routes";

const dev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || "3001", 10);

// In production, serve Next.js from the same server
const nextApp = dev ? null : next({ dev: false, dir: process.cwd() });
const nextHandler = nextApp ? nextApp.getRequestHandler() : null;

async function start() {
  // Prepare Next.js in production
  if (nextApp) {
    await nextApp.prepare();
  }

  const allowedOrigins = dev
    ? ["http://localhost:3000", "http://localhost:3001"]
    : [process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "*"];

  const app = express();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use("/assets", express.static(path.join(process.cwd(), "generated-assets")));

  const httpServer = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // REST routes (health check, session list, etc.)
  setupRoutes(app);

  // Socket.io game handlers
  setupSocketHandlers(io);

  // In production, let Next.js handle all non-API routes
  if (nextHandler) {
    app.all("*", (req, res) => nextHandler(req, res));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🎮 Escape Room server running on port ${PORT}`);
    console.log(`   Mode: ${dev ? "development" : "production"}`);
    console.log(`   Socket.io ready for connections`);
    console.log(`   API key configured: ${process.env.ANTHROPIC_API_KEY ? "✅" : "❌ Missing ANTHROPIC_API_KEY"}`);
    console.log(`   DALL-E (OpenAI): ${process.env.OPENAI_API_KEY ? "✅" : "not configured (gradient fallback)"}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
