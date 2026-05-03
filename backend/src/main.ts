import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./core/config.js";
import { registerGameRoutes } from "./api/game.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  registerGameRoutes(app);

  app.get("/health", async () => ({ status: "ok", name: "HeistMind" }));

  try {
    await app.listen({ host: config.host, port: config.port });
    console.log(`🚀 HeistMind backend running at http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
