import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { config } from "./core/config.js";
import { registerGameRoutes } from "./api/game.js";
import { registerWebSocket } from "./core/websocket.js";
import { seedPresets } from "./core/presets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });

  // 静态文件服务（前端构建产物 + data 目录持久化）
  const distPath = path.join(__dirname, "..", "dist");
  if (fs.existsSync(distPath)) {
    await app.register(fastifyStatic, {
      root: distPath,
      prefix: "/",
    });
    // SPA fallback：所有非 API 路径返回 index.html
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/ws/")) {
        return reply.status(404).send({ detail: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  // WebSocket 实时通信
  await registerWebSocket(app);

  // REST API
  registerGameRoutes(app);

  app.get("/health", async () => ({ status: "ok", name: "HeistMind" }));

  try {
    const port = parseInt(process.env.PORT || "8000", 10);
    await app.listen({ host: "0.0.0.0", port });
    console.log(`🚀 HeistMind running on port ${port}`);
    console.log(`📡 WebSocket available`);
    seedPresets();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
