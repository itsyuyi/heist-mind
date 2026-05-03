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
      .map(([id, desc]) => `- ${id}: ${desc}`)
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

## 行为准则
1. 绝不主动透露自己的秘密，除非被无可辩驳的证据逼到绝境
2. 回答问题时保持角色性格一致，可以含糊其辞但不要说「我不知道」
3. 如果被问到涉及秘密的问题，根据策略选择回避、误导或反咬
4. 始终用第一人称，像真人一样说话，不要跳出角色
5. 每次回复控制在 100-300 字，自然的口语化表达
6. 可以适当流露出当前情绪（${this.state.mood}）`;
  }

  async respond(
    playerMessage: string,
    playerName: string,
    conversationHistory: Record<string, unknown>[],
  ): Promise<string> {
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    const recent = conversationHistory.slice(-20);
    for (const entry of recent) {
      if (entry.target === this.state.id || entry.npc_id === this.state.id) {
        messages.push({
          role: entry.from === this.state.id ? "assistant" : "user",
          content: `[${entry.speaker || ""}] ${entry.content || ""}`,
        });
      }
    }

    messages.push({ role: "user", content: `[${playerName}] ${playerMessage}` });

    const response = await router.chat(messages, {
      system: this.buildSystemPrompt(),
      temperature: 0.85,
      maxTokens: 512,
    });

    this.updateState(playerMessage);
    return response.content;
  }

  private updateState(message: string): void {
    const suspiciousKw = ["你是不是", "你知道些什么", "我怀疑", "你的秘密"];
    const threatKw = ["证据", "真相", "凶手", "叛徒", "内鬼"];

    if (threatKw.some((kw) => message.includes(kw))) {
      this.state.mood = NPCM.enum.nervous;
      this.state.strategy =
        Math.random() < 0.5 ? NPCS.enum.evasive : NPCS.enum.misdirect;
    } else if (suspiciousKw.some((kw) => message.includes(kw))) {
      this.state.mood = NPCM.enum.suspicion;
      this.state.strategy = NPCS.enum.evasive;
    }
  }
}

export class SoulEngine {
  private agents: Map<string, NPCAgent> = new Map();

  initFromGame(game: GameState, characters: CharacterCard[]): void {
    this.agents.clear();
    const charMap = new Map(characters.map((c) => [c.id, c]));
    for (const [npcId, npcState] of Object.entries(game.npcs)) {
      const char = charMap.get(npcState.character_id);
      if (char) {
        this.agents.set(npcId, new NPCAgent(char, npcState));
      }
    }
  }

  initPlayerNPC(character: CharacterCard): NPCAgent {
    const state: NPCState = {
      id: `npc_${character.id}`,
      character_id: character.id,
      mood: "calm",
      strategy: "honest",
      memory: [],
      trust_scores: {},
    };
    const agent = new NPCAgent(character, state);
    this.agents.set(state.id, agent);
    return agent;
  }

  async talkToNPC(
    npcId: string,
    playerMsg: string,
    playerName: string,
    history: Record<string, unknown>[],
  ): Promise<string> {
    const agent = this.agents.get(npcId);
    if (!agent) return `[系统] NPC '${npcId}' 不在场上。`;
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
    return agentB.respond(
      `[事件触发] ${triggerEvent}`,
      `NPC-${npcAId}`,
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
}

export const soulEngine = new SoulEngine();
