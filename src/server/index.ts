import dotenv from "dotenv";
import { existsSync } from "fs";
dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env" });
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import type { ServerToClientEvents, ClientToServerEvents } from "@shared/types";
import { setupSocketHandlers } from "./socket/handlers";
import { setupRoutes } from "./routes";

const PORT = parseInt(process.env.SERVER_PORT || "3001", 10);

const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use("/assets", express.static(path.join(process.cwd(), "generated-assets")));

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "http://localhost:3000",
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

httpServer.listen(PORT, () => {
  console.log(`🎮 Escape Room server running on port ${PORT}`);
  console.log(`   Socket.io ready for connections`);
  console.log(`   API key configured: ${process.env.ANTHROPIC_API_KEY ? "✅" : "❌ Missing ANTHROPIC_API_KEY"}`);
  console.log(`   DALL-E (OpenAI): ${process.env.OPENAI_API_KEY ? "✅" : "not configured (gradient fallback)"}`);
});
