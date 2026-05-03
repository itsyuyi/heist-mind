import type { FastifyInstance } from "fastify";
import {
  CreateScriptRequest, CreateGameRequest, JoinGameRequest, PlayerAction,
  ScriptTheme, THEME_LABELS,
} from "../models/schemas.js";
import { gameService } from "../services/game_service.js";

export function registerGameRoutes(app: FastifyInstance): void {
  // 列出所有主题
  app.get("/api/v1/themes", async () => {
    return ScriptTheme.options.map((t) => ({ value: t, label: THEME_LABELS[t] }));
  });

  // 生成剧本
  app.post("/api/v1/scripts/generate", async (req, reply) => {
    const body = CreateScriptRequest.parse(req.body);
    try {
      const script = await gameService.createScript(
        body.theme, body.player_count, body.title, body.extra_requirements,
      );
      return script;
    } catch (e: unknown) {
      return reply.status(500).send({ detail: (e as Error).message });
    }
  });

  // 列出所有剧本
  app.get("/api/v1/scripts", async () => {
    return gameService.listScripts();
  });

  // 获取单个剧本
  app.get("/api/v1/scripts/:scriptId", async (req, reply) => {
    const { scriptId } = req.params as { scriptId: string };
    const script = gameService.getScript(scriptId);
    if (!script) return reply.status(404).send({ detail: "剧本不存在" });
    return script;
  });

  // 创建游戏
  app.post("/api/v1/games", async (req, reply) => {
    const body = CreateGameRequest.parse(req.body);
    try {
      return await gameService.createGame(body);
    } catch (e: unknown) {
      return reply.status(400).send({ detail: (e as Error).message });
    }
  });

  // 加入游戏
  app.post("/api/v1/games/:gameId/join", async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    const body = JoinGameRequest.parse(req.body);
    try {
      body.game_id = gameId;
      return await gameService.joinGame(body);
    } catch (e: unknown) {
      return reply.status(400).send({ detail: (e as Error).message });
    }
  });

  // 获取游戏状态
  app.get("/api/v1/games/:gameId", async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    const game = gameService.getGame(gameId);
    if (!game) return reply.status(404).send({ detail: "游戏不存在" });
    return game;
  });

  // 获取投票状态
  app.get("/api/v1/games/:gameId/votes", async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    const game = gameService.getGame(gameId);
    if (!game) return reply.status(404).send({ detail: "游戏不存在" });
    return { phase: game.phase, total_players: Object.keys(game.players).length };
  });

  // 开始游戏
  app.post("/api/v1/games/:gameId/start", async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    try {
      return await gameService.startGame(gameId);
    } catch (e: unknown) {
      return reply.status(400).send({ detail: (e as Error).message });
    }
  });

  // 玩家行动
  app.post("/api/v1/games/:gameId/action", async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    const body = PlayerAction.parse(req.body);
    try {
      body.game_id = gameId;
      return await gameService.processAction(body);
    } catch (e: unknown) {
      return reply.status(400).send({ detail: (e as Error).message });
    }
  });

  // 下一轮
  app.post("/api/v1/games/:gameId/next-round", async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    try {
      return await gameService.nextRound(gameId);
    } catch (e: unknown) {
      return reply.status(400).send({ detail: (e as Error).message });
    }
  });

  // 结束游戏
  app.post("/api/v1/games/:gameId/end", async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    try {
      return await gameService.endGame(gameId);
    } catch (e: unknown) {
      return reply.status(400).send({ detail: (e as Error).message });
    }
  });
}
