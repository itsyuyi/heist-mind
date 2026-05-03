import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./core/config.js";
import { registerGameRoutes } from "./api/game.js";
import { registerWebSocket } from "./core/websocket.js";
import { seedPresets } from "./core/presets.js";

async function main() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  
  // WebSocket 实时通信
  await registerWebSocket(app);
  
  // REST API
  registerGameRoutes(app);

  app.get("/health", async () => ({ status: "ok", name: "HeistMind" }));

  try {
    await app.listen({ host: config.host, port: config.port });
    console.log(`🚀 HeistMind running at http://${config.host}:${config.port}`);
    console.log(`📡 WebSocket available at ws://${config.host}:${config.port}/ws/:gameId`);
    
    // 初始化预设剧本
    seedPresets();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
