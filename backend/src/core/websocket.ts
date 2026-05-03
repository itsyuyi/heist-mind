/** WebSocket 实时通信层 */

import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

interface WSClient {
  socket: WebSocket;
  gameId: string;
  playerId: string;
}

const clients: Map<string, WSClient[]> = new Map();

export function registerWebSocket(app: FastifyInstance): void {
  app.register(async function (fastify) {
    const wsModule = await import("@fastify/websocket");
    await fastify.register(wsModule.default);

    fastify.get("/ws/:gameId", { websocket: true } as any, (socket: any, req: any) => {
      const params = req.params as { gameId: string };
      const gameId = params.gameId;
      const playerId = (req.query as Record<string, string>)?.playerId || "";

      const client: WSClient = { socket, gameId, playerId };

      if (!clients.has(gameId)) {
        clients.set(gameId, []);
      }
      clients.get(gameId)!.push(client);

      console.log(`[WS] Player ${playerId} connected to game ${gameId}`);

      socket.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          broadcastToGame(gameId, {
            type: msg.type || "chat",
            playerId,
            ...msg,
          }, playerId);
        } catch { /* ignore malformed messages */ }
      });

      socket.on("close", () => {
        const room = clients.get(gameId);
        if (room) {
          const idx = room.indexOf(client);
          if (idx >= 0) room.splice(idx, 1);
          if (room.length === 0) clients.delete(gameId);
        }
        console.log(`[WS] Player ${playerId} disconnected from game ${gameId}`);
      });

      socket.send(JSON.stringify({
        type: "connected",
        gameId,
        playerId,
        timestamp: Date.now(),
      }));
    });
  });
}

export function broadcastToGame(
  gameId: string,
  data: Record<string, unknown>,
  excludePlayerId?: string,
): void {
  const room = clients.get(gameId);
  if (!room) return;

  const payload = JSON.stringify(data);
  for (const client of room) {
    if (client.playerId !== excludePlayerId && client.socket.readyState === 1) {
      client.socket.send(payload);
    }
  }
}

export function broadcastToAll(gameId: string, data: Record<string, unknown>): void {
  const room = clients.get(gameId);
  if (!room) return;

  const payload = JSON.stringify(data);
  for (const client of room) {
    if (client.socket.readyState === 1) {
      client.socket.send(payload);
    }
  }
}

export function sendToPlayer(gameId: string, playerId: string, data: Record<string, unknown>): void {
  const room = clients.get(gameId);
  if (!room) return;

  const payload = JSON.stringify(data);
  for (const client of room) {
    if (client.playerId === playerId && client.socket.readyState === 1) {
      client.socket.send(payload);
      return;
    }
  }
}
