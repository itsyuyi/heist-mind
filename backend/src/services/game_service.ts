/** 游戏服务：管理游戏生命周期、状态存储、持久化和实时广播。 */

import { v4 as uuid } from "uuid";
import { worldBuilder, soulEngine, gameMaster } from "../agents/index.js";
import type {
  Script, ScriptTheme, GameState, PlayerState, NPCState,
  CreateScriptRequest, CreateGameRequest, JoinGameRequest, PlayerAction,
} from "../models/schemas.js";
import {
  dbSaveScript, dbGetScript, dbListScripts,
  dbSaveGame, dbGetGame,
} from "../core/database.js";
import { broadcastToGame } from "../core/websocket.js";

export class GameService {
  private scripts: Map<string, Script> = new Map();
  private games: Map<string, GameState> = new Map();

  constructor() {
    // 从数据库恢复数据
    this.loadFromDB();
  }

  private loadFromDB(): void {
    const dbScripts = dbListScripts() as { id: string }[];
    for (const s of dbScripts) {
      const script = dbGetScript(s.id) as Script | null;
      if (script) this.scripts.set(script.id, script);
    }
  }

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
    dbSaveScript(script);
    return script;
  }

  getScript(scriptId: string): Script | undefined {
    // 先查内存
    let script: Script | undefined = this.scripts.get(scriptId);
    // 再查数据库
    if (!script) {
      const fromDB = dbGetScript(scriptId) as Script | null;
      if (fromDB) { script = fromDB; this.scripts.set(script.id, script); }
    }
    return script || undefined;
  }

  listScripts(): Script[] {
    // 合并内存和数据库中的剧本
    const seen = new Set<string>();
    const all: Script[] = [];
    for (const s of this.scripts.values()) {
      if (!seen.has(s.id)) { all.push(s); seen.add(s.id); }
    }
    // 补充数据库中的
    const dbScripts = dbListScripts() as { id: string }[];
    for (const s of dbScripts) {
      if (!seen.has(s.id)) {
        const script = dbGetScript(s.id) as Script | null;
        if (script) { all.push(script); seen.add(s.id); }
      }
    }
    return all;
  }

  async createGame(req: CreateGameRequest): Promise<GameState> {
    const script = this.getScript(req.script_id);
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
    dbSaveGame(game);
    return game;
  }

  async joinGame(req: JoinGameRequest): Promise<PlayerState> {
    if (!req.game_id) throw new Error("缺少 game_id");
    const game = this.games.get(req.game_id) ||
      (dbGetGame(req.game_id) as GameState | null);
    if (!game) throw new Error(`游戏 ${req.game_id} 不存在`);

    const script = this.getScript(game.script_id);
    if (!script) throw new Error("剧本不存在");

    for (const p of Object.values(game.players)) {
      if (p.character_id === req.character_id) {
        throw new Error(`角色 ${req.character_id} 已被其他玩家选择`);
      }
    }

    const char = script.characters.find((c: any) => c.id === req.character_id);
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

    if (!this.games.has(game.id)) this.games.set(game.id, game);
    soulEngine.initFromGame(game, script.characters);

    // 广播玩家加入
    broadcastToGame(game.id, {
      type: "player_joined",
      player_name: player.name,
      character_name: char.name,
      timestamp: Date.now(),
    });

    return player;
  }

  getGame(gameId: string): GameState | undefined {
    let game: GameState | undefined = this.games.get(gameId);
    if (!game) {
      const fromDB = dbGetGame(gameId) as GameState | null;
      if (fromDB) { game = fromDB; this.games.set(game.id, game); }
    }
    return game || undefined;
  }

  async startGame(gameId: string): Promise<GameState> {
    const game = this.getGame(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);

    const script = this.getScript(game.script_id);
    if (!script) throw new Error("剧本不存在");

    game.phase = "intro";

    const intro = await gameMaster.getRoundIntro(script, game);
    game.chat_history.push({
      round: 0, type: "gm_intro", speaker: "Game Master",
      content: intro, timestamp: Date.now(),
    });

    game.current_round = 1;
    game.phase = "playing";

    const round1Intro = await gameMaster.getRoundIntro(script, game);
    game.chat_history.push({
      round: 1, type: "gm_round", speaker: "Game Master",
      content: `**第 1 轮** ${round1Intro}`, timestamp: Date.now(),
    });

    soulEngine.initFromGame(game, script.characters);

    // 广播游戏开始
    broadcastToGame(game.id, {
      type: "game_started",
      phase: game.phase,
      round: game.current_round,
      intro: round1Intro,
      timestamp: Date.now(),
    });

    return game;
  }

  async processAction(action: PlayerAction): Promise<Record<string, unknown>> {
    if (!action.game_id) throw new Error("缺少 game_id");
    const game = this.getGame(action.game_id);
    if (!game) throw new Error(`游戏 ${action.game_id} 不存在`);

    const script = this.getScript(game.script_id);
    if (!script) throw new Error("剧本不存在");

    const result: Record<string, unknown> = {
      player_id: action.player_id,
      action_type: action.action_type,
    };

    const gmResult = await gameMaster.processAction(action, script, game);
    Object.assign(result, gmResult);

    if (action.action_type === "talk" && action.target_id) {
      soulEngine.initFromGame(game, script.characters);

      const playerName = game.players[action.player_id]?.name || "未知";
      const npcResponse = await soulEngine.talkToNPC(
        action.target_id, action.content, playerName, game.chat_history,
      );
      result.npc_response = npcResponse;

      const npcStates = soulEngine.getNPCStates();
      for (const [npcId, state] of Object.entries(npcStates)) {
        if (game.npcs[npcId]) {
          game.npcs[npcId].mood = state.mood;
          game.npcs[npcId].strategy = state.strategy;
        }
      }

      for (const npcId of Object.keys(game.npcs)) {
        if (npcId !== action.target_id) {
          const triggered = await soulEngine.npcInteract(
            action.target_id, npcId,
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

    if (action.action_type === "vote" && gmResult.verdict) {
      result.verdict = gmResult.verdict;
      result.all_voted = true;
    }

    game.chat_history.push({
      round: game.current_round, timestamp: Date.now(),
      player_id: action.player_id, action_type: action.action_type,
      target_id: action.target_id, content: action.content,
      result: result.narrative || result.npc_response || "",
    });

    // 广播行动结果
    broadcastToGame(game.id, {
      type: "action_result",
      data: result,
      timestamp: Date.now(),
    }, action.player_id);

    return result;
  }

  async nextRound(gameId: string): Promise<Record<string, unknown>> {
    const game = this.getGame(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);

    const script = this.getScript(game.script_id);
    if (!script) throw new Error("剧本不存在");

    game.current_round += 1;

    if (game.current_round > script.rounds) {
      game.phase = "voting";
      game.chat_history.push({
        round: game.current_round - 1, type: "gm_round",
        speaker: "Game Master",
        content: "所有轮次已结束。请所有玩家进行最终投票，指认你认为的真凶！",
        timestamp: Date.now(),
      });
      dbSaveGame(game);
      broadcastToGame(game.id, {
        type: "voting_start", phase: "voting",
        message: "所有轮次已结束，请投票！",
        timestamp: Date.now(),
      });
      return { phase: "voting", message: "所有轮次已结束，请投票！", intro: "请投票！" };
    }

    const intro = await gameMaster.getRoundIntro(script, game);
    game.chat_history.push({
      round: game.current_round, type: "gm_round",
      speaker: "Game Master",
      content: `**第 ${game.current_round} 轮** ${intro}`,
      timestamp: Date.now(),
    });

    const npcIds = Object.keys(game.npcs);
    const shuffled = npcIds.sort(() => Math.random() - 0.5);
    const npcChatter: string[] = [];
    soulEngine.initFromGame(game, script.characters);

    for (let i = 0; i < Math.min(2, shuffled.length); i++) {
      try {
        const chat = await soulEngine.npcAutonomousChat(shuffled[i], "新一轮开始了，你有什么想说的吗？");
        if (chat) {
          npcChatter.push(chat);
          game.chat_history.push({
            round: game.current_round, type: "npc_auto",
            speaker: script.characters.find(
              (c) => c.id === game.npcs[shuffled[i]].character_id,
            )?.name || shuffled[i],
            content: chat, timestamp: Date.now(),
          });
        }
      } catch { /* ignore */ }
    }

    dbSaveGame(game);
    broadcastToGame(game.id, {
      type: "round_change", phase: game.phase,
      round: game.current_round, intro, npc_chatter: npcChatter,
      timestamp: Date.now(),
    });

    return { phase: game.phase, round: game.current_round, intro, npc_chatter: npcChatter };
  }

  async endGame(gameId: string): Promise<Record<string, unknown>> {
    const game = this.getGame(gameId);
    if (!game) throw new Error(`游戏 ${gameId} 不存在`);

    const script = this.getScript(game.script_id);
    if (!script) throw new Error("剧本不存在");

    game.phase = "ended";

    const recap = await gameMaster.generateRecap(script, game);
    game.chat_history.push({
      round: game.current_round, type: "gm_end",
      speaker: "Game Master", content: "游戏结束！",
      timestamp: Date.now(),
    });

    dbSaveGame(game);
    broadcastToGame(game.id, {
      type: "game_ended", phase: "ended", recap,
      timestamp: Date.now(),
    });

    return { phase: "ended", recap };
  }
}

export const gameService = new GameService();
