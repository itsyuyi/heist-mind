/** WebSocket 实时通信客户端 */

type WSMessageHandler = (data: Record<string, unknown>) => void;

class GameSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, WSMessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private gameId = "";
  private playerId = "";

  connect(gameId: string, playerId: string): void {
    this.gameId = gameId;
    this.playerId = playerId;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/${gameId}?playerId=${playerId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[WS] Connected to game", gameId);
      this.emit("connected", { gameId, playerId });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type as string;
        if (type) {
          this.emit(type, data);
          this.emit("*", data);
        }
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      console.log("[WS] Disconnected, reconnecting in 3s...");
      this.reconnectTimer = setTimeout(() => this.connect(gameId, playerId), 3000);
    };

    this.ws.onerror = (e) => {
      console.error("[WS] Error", e);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(type: string, handler: WSMessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
    return () => {
      const arr = this.handlers.get(type);
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  private emit(type: string, data: Record<string, unknown>): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const gameSocket = new GameSocket();
