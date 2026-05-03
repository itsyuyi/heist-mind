/** 游戏服务：管理游戏生命周期、状态存储。 */

import { v4 as uuid } from "uuid";
import { worldBuilder, soulEngine, gameMaster } from "../agents/index.js";
import type {
  Script, ScriptTheme, GameState, PlayerState, NPCState,
  CreateScriptRequest, CreateGameRequest, JoinGameRequest, PlayerAction,
} from "../models/schemas.js";

export class GameService {
  private scripts: Map<string, Script> = new Map();
  private games: Map<string, GameState> = new Map();

  async createScript(
    theme: ScriptTheme,
    playerCount: number,
    title?: string,
    extra?: string,
  ): Promise<Script> {
    const req: CreateScriptRequest = {
      theme,
      player_count: playerCount,
      title,
      extra_requirements: extra,
    };
    const script = await worldBuilder.generateScript(req);
    this.scripts.set(script.id, script);
    return script;
  }

  getScript(scriptId: string): Script | undefined {
    return this.scripts.get(scriptId);
  }

  listScripts(): Script[] {
    return [...this.scripts.values()];
  }

  async createGame(req: CreateGameRequest): Promise<GameState> {
    const script = this.scripts.get(req.script_id);
    if (!script) throw new Error(`剧本 ${req.script_id} 不存在`);

    const gameId = `game_${uuid().slice(0, 8)}`;
    const game: GameState = {
      id: gameId,
      script_id: script.id,
      phase: "waiting",
      current_round: 1,
      players: {},
      npcs: {},
      revealed_clues: [],
      chat_history: [],
      game_master_notes: "",
      total_tokens_used: 0,
    };

    // 初始化 NPC 状态
    for (const char of script.characters) {
      const npcId = `npc_${char.id}`;
      game.npcs[npcId] = {
        id: npcId,
        character_id: char.id,
        mood: "calm",
        strategy: "honest",
        memory: [],
        trust_scores: {},
      };
    }

    this.games.set(gameId, game);
    return game;
  }

  async joinGame(req: JoinGameRequest): Promise<PlayerState> {
    if (!req.game_id) throw new Error("缺少 game_id");
    const game = this.games.get(req.game_id);
    if (!game) throw new Error(`游戏 ${req.game_id} 不存在`);

    const script = this.scripts.get(game.script_id);
    if (!script) throw new Error("剧本不存在");

    // 检查角色是否被占用
    for (const p of Object.values(game.players)) {
      if (p.character_id === req.character_id) {
        throw new Error(`角色 ${req.character_id} 已被其他玩家选择`);
      }
    }

    // 检查角色是否存在
    const char = script.characters.find((c) => c.id === req.character_id);
    if (!char) throw new Error(`角色 ${req.character_id} 不存在于该剧本中`);

    const playerId = `player_${uuid().slice(0, 8)}`;
    const player: PlayerState = {
      id: playerId,
      name: req.player_name,
      character_id: req.character_id,
      notes: "",
      clue_ids: [],
      is_alive: true,
      is_ready: false,
    };
    game.players[playerId] = player;
    return player;
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  async startGame(gameId: string): Promise<GameState> {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);
    game.phase = "intro";
    return game;
  }

  async processAction(action: PlayerAction): Promise<Record<string, unknown>> {
    if (!action.game_id) throw new Error("缺少 game_id");
    const game = this.games.get(action.game_id);
    if (!game) throw new Error(`游戏 ${action.game_id} 不存在`);

    const script = this.scripts.get(game.script_id);
    if (!script) throw new Error("剧本不存在");

    const result: Record<string, unknown> = {
      player_id: action.player_id,
      action_type: action.action_type,
    };

    // 处理 GM 裁决
    const gmResult = await gameMaster.processAction(action, script, game);
    Object.assign(result, gmResult);

    // 对话 → Soul Engine
    if (action.action_type === "talk" && action.target_id) {
      soulEngine.initFromGame(game, script.characters);

      const playerName = game.players[action.player_id]?.name || "未知";
      const npcResponse = await soulEngine.talkToNPC(
        action.target_id,
        action.content,
        playerName,
        game.chat_history,
      );
      result.npc_response = npcResponse;

      // 蝴蝶效应
      for (const npcId of Object.keys(game.npcs)) {
        if (npcId !== action.target_id) {
          const triggered = await soulEngine.npcInteract(
            action.target_id,
            npcId,
            `玩家向 ${action.target_id} 说了：${action.content.slice(0, 50)}...`,
            game.chat_history,
          );
          if (triggered) {
            result[`npc_${npcId}_reaction`] = triggered;
            break;
          }
        }
      }
    }

    // 记录聊天历史
    game.chat_history.push({
      round: game.current_round,
      player_id: action.player_id,
      action_type: action.action_type,
      target_id: action.target_id,
      content: action.content,
      result: result.narrative || "",
    });

    return result;
  }

  async nextRound(gameId: string): Promise<Record<string, unknown>> {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);

    const script = this.scripts.get(game.script_id);
    if (!script) throw new Error("剧本不存在");

    game.current_round += 1;
    if (game.current_round > script.rounds) {
      game.phase = "voting";
      return { phase: "voting", message: "请所有玩家进行最终投票！" };
    }

    if (game.current_round === 1) {
      game.phase = "playing";
    }

    const intro = gameMaster.getRoundIntro(script, game);
    return { phase: game.phase, round: game.current_round, intro };
  }

  async endGame(gameId: string): Promise<Record<string, unknown>> {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);

    const script = this.scripts.get(game.script_id);
    game.phase = "ended";

    const recap = await gameMaster.generateRecap(script!, game);
    return { phase: "ended", recap };
  }
}

export const gameService = new GameService();
