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
    
    // 同步 Soul Engine 中的 NPC 状态
    soulEngine.initFromGame(game, script.characters);
    
    return player;
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  async startGame(gameId: string): Promise<GameState> {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);
    
    const script = this.scripts.get(game.script_id);
    if (!script) throw new Error("剧本不存在");
    
    game.phase = "intro";
    
    // 生成开场 AI 描述
    const intro = await gameMaster.getRoundIntro(script, game);
    game.chat_history.push({
      round: 0,
      type: "gm_intro",
      speaker: "Game Master",
      content: intro,
      timestamp: Date.now(),
    });
    
    // 进入第一轮
    game.current_round = 1;
    game.phase = "playing";
    
    const round1Intro = await gameMaster.getRoundIntro(script, game);
    game.chat_history.push({
      round: 1,
      type: "gm_round",
      speaker: "Game Master",
      content: `**第 1 轮** ${round1Intro}`,
      timestamp: Date.now(),
    });
    
    // 初始化 Soul Engine
    soulEngine.initFromGame(game, script.characters);
    
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

      // 更新游戏中的 NPC 状态（同步情绪变化）
      const npcStates = soulEngine.getNPCStates();
      for (const [npcId, state] of Object.entries(npcStates)) {
        if (game.npcs[npcId]) {
          game.npcs[npcId].mood = state.mood;
          game.npcs[npcId].strategy = state.strategy;
        }
      }

      // 蝴蝶效应：其他 NPC 可能对这次对话产生反应
      for (const npcId of Object.keys(game.npcs)) {
        if (npcId !== action.target_id) {
          const triggered = await soulEngine.npcInteract(
            action.target_id,
            npcId,
            `玩家向某人说了：${action.content.slice(0, 40)}...`,
            game.chat_history,
          );
          if (triggered) {
            const char = script.characters.find(
              (c) => c.id === game.npcs[npcId].character_id,
            );
            result[`butterfly_${char?.name || npcId}`] = triggered;
          }
        }
      }
    }

    // 投票 → 检查是否有裁决结果
    if (action.action_type === "vote" && gmResult.verdict) {
      result.verdict = gmResult.verdict;
      result.all_voted = true;
    }

    // 记录聊天历史
    game.chat_history.push({
      round: game.current_round,
      timestamp: Date.now(),
      player_id: action.player_id,
      action_type: action.action_type,
      target_id: action.target_id,
      content: action.content,
      result: result.narrative || result.npc_response || "",
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
      const roundEndMsg = {
        round: game.current_round - 1,
        type: "gm_round",
        speaker: "Game Master",
        content: "所有轮次已结束。请所有玩家进行最终投票，指认你认为的真凶！",
        timestamp: Date.now(),
      };
      game.chat_history.push(roundEndMsg);
      return {
        phase: "voting",
        message: "所有轮次已结束，请投票！",
        intro: "请所有玩家进行最终投票，指认你认为的真凶！",
      };
    }

    // 生成下一轮的 AI 描述
    const intro = await gameMaster.getRoundIntro(script, game);
    game.chat_history.push({
      round: game.current_round,
      type: "gm_round",
      speaker: "Game Master",
      content: `**第 ${game.current_round} 轮** ${intro}`,
      timestamp: Date.now(),
    });

    // NPC 自主发言（随机触发 1-2 个 NPC 对局势发表看法）
    const npcIds = Object.keys(game.npcs);
    const shuffled = npcIds.sort(() => Math.random() - 0.5);
    const npcChatter: string[] = [];
    soulEngine.initFromGame(game, script.characters);
    
    for (let i = 0; i < Math.min(2, shuffled.length); i++) {
      try {
        const chat = await soulEngine.npcAutonomousChat(
          shuffled[i],
          `新一轮开始了，你有什么想说的吗？`,
        );
        if (chat) {
          npcChatter.push(chat);
          game.chat_history.push({
            round: game.current_round,
            type: "npc_auto",
            speaker: script.characters.find(
              (c) => c.id === game.npcs[shuffled[i]].character_id,
            )?.name || shuffled[i],
            content: chat,
            timestamp: Date.now(),
          });
        }
      } catch { /* ignore NPC chat errors */ }
    }

    return {
      phase: game.phase,
      round: game.current_round,
      intro,
      npc_chatter: npcChatter,
    };
  }

  async endGame(gameId: string): Promise<Record<string, unknown>> {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);

    const script = this.scripts.get(game.script_id);
    if (!script) throw new Error("剧本不存在");
    
    game.phase = "ended";

    const recap = await gameMaster.generateRecap(script, game);
    game.chat_history.push({
      round: game.current_round,
      type: "gm_end",
      speaker: "Game Master",
      content: "游戏结束！",
      timestamp: Date.now(),
    });

    return { phase: "ended", recap };
  }
}

export const gameService = new GameService();
