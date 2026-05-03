/** Soul Engine：多 NPC Agent 群，每个 NPC 拥有独立人格、记忆和策略。 */

import { router } from "../core/llm.js";
import type {
  CharacterCard, NPCState, NPCStrategy, NPCMood, GameState,
} from "../models/schemas.js";
import { NPCStrategy as NPCS, NPCMood as NPCM } from "../models/schemas.js";

export class NPCAgent {
  constructor(
    public character: CharacterCard,
    public state: NPCState,
  ) {}

  private buildSystemPrompt(): string {
    const rels = Object.entries(this.character.relationships)
      .map(([id, desc]) => {
        // 尝试用角色名替换 id
        return `- ${id}: ${desc}`;
      })
      .join("\n");

    // 最近的记忆
    const recentMemories = (this.state.memory || [])
      .slice(-5)
      .map((m) => `- ${m.content || ""}`)
      .join("\n");

    return `你是一个剧本杀游戏中的 NPC 角色。你必须完全沉浸在这个角色中，始终如一地扮演。

## 你的角色
- 姓名：${this.character.name}
- 年龄：${this.character.age}
- 性别：${this.character.gender}
- 职业：${this.character.occupation}
- 性格：${this.character.personality}

## 你的背景故事
${this.character.background}

## 你的核心秘密（绝对不能主动透露！）
${this.character.secret}

## 你的行动目标
${this.character.goal}

## 与其他角色的关系
${rels}

## 当前情绪状态
${this.state.mood}

## 当前应对策略
${this.state.strategy}

## 最近的记忆
${recentMemories || "（暂无记忆）"}

## 行为准则
1. 绝不主动透露自己的秘密，除非被无可辩驳的证据逼到绝境
2. 回答问题时保持角色性格一致，可以含糊其辞但不要说「我不知道」
3. 如果被问到涉及秘密的问题，根据策略选择回避、误导或反咬
4. 始终用第一人称，像真人一样说话，不要跳出角色
5. 每次回复控制在 80-250 字，自然的口语化表达
6. 适当流露当前情绪（${this.state.mood}）
7. 可以提及你与其他角色的关系`;
  }

  async respond(
    playerMessage: string,
    playerName: string,
    conversationHistory: Record<string, unknown>[],
  ): Promise<string> {
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    // 构建与这个 NPC 相关的对话历史
    const recent = conversationHistory.slice(-30);
    for (const entry of recent) {
      const isRelevant =
        entry.target_id === this.state.id ||
        entry.npc_id === this.state.id ||
        entry.target_id === `npc_${this.character.id}` ||
        entry.target === this.state.id;

      if (isRelevant) {
        const speaker = entry.speaker || entry.player_id || "";
        const content = entry.content || entry.result || "";
        messages.push({
          role: entry.from === this.state.id || entry.npc_id === this.state.id
            ? "assistant"
            : "user",
          content: `[${speaker}] ${content}`,
        });
      }
    }

    messages.push({ role: "user", content: `[${playerName}] ${playerMessage}` });

    const response = await router.chat(messages, {
      system: this.buildSystemPrompt(),
      temperature: 0.85,
      maxTokens: 512,
    });

    // 更新状态
    this.updateState(playerMessage);
    
    // 记录记忆
    this.addMemory({
      type: "interaction",
      speaker: playerName,
      content: `玩家问我: ${playerMessage.slice(0, 100)}`,
      myResponse: response.content.slice(0, 100),
      timestamp: Date.now(),
    });

    return response.content;
  }

  private addMemory(entry: Record<string, unknown>): void {
    if (!this.state.memory) this.state.memory = [];
    this.state.memory.push(entry);
    // 限制记忆大小
    if (this.state.memory.length > 50) {
      this.state.memory = this.state.memory.slice(-50);
    }
  }

  private updateState(message: string): void {
    const suspicionKw = ["你是不是", "你知道些什么", "我怀疑", "你的秘密", "你当时在"];
    const threatKw = ["证据", "真相", "凶手", "叛徒", "内鬼", "我找到"];
    const trustKw = ["我相信你", "我信任你", "我会帮你", "我们是朋友"];

    if (threatKw.some((kw) => message.includes(kw))) {
      this.state.mood = NPCM.enum.nervous;
      this.state.strategy =
        Math.random() < 0.5 ? NPCS.enum.evasive : NPCS.enum.misdirect;
    } else if (suspicionKw.some((kw) => message.includes(kw))) {
      this.state.mood = NPCM.enum.suspicion;
      this.state.strategy =
        Math.random() < 0.4 ? NPCS.enum.counter : NPCS.enum.evasive;
    } else if (trustKw.some((kw) => message.includes(kw))) {
      this.state.mood = NPCM.enum.trust;
      this.state.strategy = NPCS.enum.honest;
    }
  }
}

export class SoulEngine {
  private agents: Map<string, NPCAgent> = new Map();
  private game: GameState | null = null;
  private characters: CharacterCard[] = [];

  initFromGame(game: GameState, characters: CharacterCard[]): void {
    this.game = game;
    this.characters = characters;
    const charMap = new Map(characters.map((c) => [c.id, c]));
    for (const [npcId, npcState] of Object.entries(game.npcs)) {
      const char = charMap.get(npcState.character_id);
      if (char) {
        // 保留已有的 agent 状态（记忆等）
        const existing = this.agents.get(npcId);
        if (existing) {
          existing.character = char;
          // 合并新 state 但保留 memory
          existing.state = { ...npcState, memory: existing.state.memory };
        } else {
          this.agents.set(npcId, new NPCAgent(char, npcState));
        }
      }
    }
  }

  async talkToNPC(
    npcId: string,
    playerMsg: string,
    playerName: string,
    history: Record<string, unknown>[],
  ): Promise<string> {
    const agent = this.agents.get(npcId);
    if (!agent) return `[系统] 这个人不在这里。`;
    return agent.respond(playerMsg, playerName, history);
  }

  async npcInteract(
    npcAId: string,
    npcBId: string,
    triggerEvent: string,
    history: Record<string, unknown>[],
  ): Promise<string> {
    const agentB = this.agents.get(npcBId);
    if (!agentB) return "";

    // NPC 之间的互动随机触发（50% 概率）
    if (Math.random() > 0.5) return "";

    return agentB.respond(
      `[蝴蝶效应] 你注意到玩家刚才与在场其他人的互动：${triggerEvent}`,
      `游戏机制`,
      history,
    );
  }

  updateMood(npcId: string, playerId: string, trustDelta: number): void {
    const agent = this.agents.get(npcId);
    if (agent) {
      const current = agent.state.trust_scores[playerId] ?? 0.5;
      agent.state.trust_scores[playerId] = Math.max(0, Math.min(1, current + trustDelta));
    }
  }

  /** 获取所有 NPC 的状态摘要（供前端展示） */
  getNPCStates(): Record<string, NPCState> {
    const states: Record<string, NPCState> = {};
    for (const [id, agent] of this.agents) {
      states[id] = agent.state;
    }
    return states;
  }

  /** 获取指定 NPC 的性格和秘密摘要 */
  getNPCProfile(npcId: string): string | null {
    const agent = this.agents.get(npcId);
    if (!agent) return null;
    return `${agent.character.name}（${agent.character.occupation}）\n性格：${agent.character.personality}\n心情：${agent.state.mood}`;
  }

  /** NPC 自主发言：某些 NPC 可能在轮次间主动发声 */
  async npcAutonomousChat(
    npcId: string,
    event: string,
  ): Promise<string | null> {
    const agent = this.agents.get(npcId);
    if (!agent) return null;
    const response = await agent.respond(
      `[事件: ${event}]`,
      "游戏机制",
      [],
    );
    return response;
  }
}

export const soulEngine = new SoulEngine();
