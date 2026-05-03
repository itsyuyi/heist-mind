/** Game Master：主持 Agent，控制游戏节奏和规则裁决。 */

import { router } from "../core/llm.js";
import type {
  Script, GameState, PlayerAction, PlayerState, Clue,
} from "../models/schemas.js";

export class GameMaster {
  private buildSystemPrompt(script: Script, game: GameState): string {
    const playerList = Object.values(game.players)
      .map((p) => {
        const char = script.characters.find((c) => c.id === p.character_id);
        return `- ${p.name}（扮演 ${char?.name || "未知"}）`;
      })
      .join("\n");

    return `你是一个剧本杀游戏的主持人（Game Master）。你负责控制游戏节奏、分发线索、裁决玩家行动。

## 当前剧本
- 标题：${script.title}
- 主题：${script.theme}
- 故事概要：${script.summary}
- 时间线：${script.timeline}

## 游戏状态
- 当前轮次：${game.current_round}/${script.rounds}
- 阶段：${game.phase}

## 当前玩家
${playerList || "暂无玩家"}

## 你的职责
1. 在每轮开始时进行剧情推进描述（营造氛围，暗示矛盾）
2. 当玩家调查时，根据他们描述的内容智能匹配最相关的线索
3. 描述线索发现过程时，结合玩家的调查描述
4. 在僵局时投放提示（但不直接揭示真相）
5. 管理投票环节，揭晓投票结果
6. 确保游戏不跑偏，玩家行为符合角色设定

## 行为准则
- 保持中立，不偏袒任何一方
- 不要透露剧本的核心秘密或凶手身份
- 用文学化的语言描述场景和事件
- 线索分发要有节奏感，不要一次性给太多
- 当玩家做出精彩推理时，给予适当的氛围反馈
- 回复长度控制在 80-200 字`;
  }

  async getRoundIntro(script: Script, game: GameState): Promise<string> {
    const prompt = `第 ${game.current_round} 轮开始。请用 80-150 字的文学化语言描述当前场景的氛围和紧张局势，暗示可能的发展方向。不要直接透露真相。`;
    
    const response = await router.chat(
      [{ role: "user", content: prompt }],
      {
        system: this.buildSystemPrompt(script, game),
        temperature: 0.85,
        maxTokens: 300,
      },
    );
    return response.content;
  }

  async processAction(
    action: PlayerAction,
    script: Script,
    game: GameState,
  ): Promise<Record<string, unknown>> {
    const player = game.players[action.player_id];
    if (!player) return { error: "玩家不存在", narrative: "" };

    switch (action.action_type) {
      case "investigate":
        return this.handleInvestigate(action, script, game, player);
      case "talk":
        return { action: "talk", narrative: "", target_id: action.target_id };
      case "vote":
        return this.handleVote(action, script, game, player);
      case "use_skill":
        return this.handleSkill(action, script, game, player);
      default:
        return { error: `未知行动类型: ${action.action_type}`, narrative: "" };
    }
  }

  private async handleInvestigate(
    action: PlayerAction,
    script: Script,
    game: GameState,
    player: PlayerState,
  ): Promise<Record<string, unknown>> {
    // 筛选当前轮次可用的未揭示线索
    const available = script.clues.filter(
      (c) =>
        !game.revealed_clues.includes(c.id) &&
        c.reveal_round <= game.current_round,
    );

    if (available.length === 0) {
      // 所有线索已揭示
      return {
        action: "investigate",
        narrative: "你仔细搜查了每一个角落，但所有显眼的线索都已经被发现了。也许你需要换个思路，或者去和某人谈谈。",
        clue: null,
      };
    }

    // 智能匹配：根据玩家的调查描述匹配最相关的线索
    let matchedClue: Clue | null = null;
    
    if (action.content?.trim()) {
      // 使用简单的关键词匹配
      const content = action.content.toLowerCase();
      const scored = available.map((c) => {
        let score = 0;
        const haystack = `${c.name} ${c.description} ${c.type}`.toLowerCase();
        // 包含名称则高分
        if (content.includes(c.name.toLowerCase())) score += 5;
        // 关键词重叠
        const words = content.split(/\s+/);
        for (const w of words) {
          if (w.length > 1 && haystack.includes(w)) score += 1;
        }
        return { clue: c, score };
      });
      
      scored.sort((a, b) => b.score - a.score);
      
      // 如果匹配分数 > 2，取最佳匹配；否则随机取
      if (scored[0].score > 2) {
        matchedClue = scored[0].clue;
      } else {
        // 按揭示轮次优先，同轮次随机
        const earliestRound = Math.min(...available.map((c) => c.reveal_round));
        const earliest = available.filter((c) => c.reveal_round === earliestRound);
        matchedClue = earliest[Math.floor(Math.random() * earliest.length)];
      }
    } else {
      matchedClue = available[Math.floor(Math.random() * available.length)];
    }

    if (!matchedClue) {
      return {
        action: "investigate",
        narrative: "你的调查没有发现新的线索。",
        clue: null,
      };
    }

    game.revealed_clues.push(matchedClue.id);
    player.clue_ids.push(matchedClue.id);

    const response = await router.chat(
      [
        {
          role: "user",
          content: `玩家「${player.name}」正在调查线索：${action.content || "四处搜查"}。他发现了线索「${matchedClue.name}」：${matchedClue.description}。请用 80-160 字的文学化语言，结合玩家的调查方式来描述这个发现过程。`,
        },
      ],
      {
        system: this.buildSystemPrompt(script, game),
        temperature: 0.9,
        maxTokens: 300,
      },
    );

    return {
      action: "investigate",
      narrative: response.content,
      clue: { ...matchedClue },
    };
  }

  private voteCounts: Map<string, Map<string, string>> = new Map();

  private async handleVote(
    action: PlayerAction,
    script: Script,
    game: GameState,
    player: PlayerState,
  ): Promise<Record<string, unknown>> {
    // 初始化投票计数
    if (!this.voteCounts.has(game.id)) {
      this.voteCounts.set(game.id, new Map());
    }
    const tally = this.voteCounts.get(game.id)!;
    
    if (!action.target_id) {
      return {
        action: "vote",
        error: "请指定投票目标",
        narrative: "",
      };
    }

    // 查找目标 NPC/角色名
    const targetNpc = game.npcs[action.target_id];
    const targetChar = targetNpc
      ? script.characters.find((c) => c.id === targetNpc.character_id)
      : null;
    const targetName = targetChar?.name || action.target_id;

    // 记录投票（key: player_id, value: voted target_id）
    tally.set(action.player_id, action.target_id);
    
    // 统计当前票数（key: target_id, value: count）
    const charVotes = new Map<string, number>();
    for (const votedTarget of tally.values()) {
      charVotes.set(votedTarget, (charVotes.get(votedTarget) || 0) + 1);
    }

    const totalPlayers = Object.keys(game.players).length;
    const votedCount = tally.size;
    
    const prompt = `玩家「${player.name}」投票给了「${targetName}」，理由是：${action.content || "未说明"}。当前已投票 ${votedCount}/${totalPlayers} 人。请用 60-100 字宣布这一票并营造紧张感。`;

    const response = await router.chat(
      [{ role: "user", content: prompt }],
      {
        system: this.buildSystemPrompt(script, game),
        temperature: 0.85,
        maxTokens: 200,
      },
    );

    // 所有人投票完毕 → 揭晓结果
    let verdict: string | null = null;
    if (votedCount >= totalPlayers) {
      // 找最多票的
      let maxVotes = 0;
      let mostVotedTarget = "";
      for (const [t, c] of charVotes) {
        if (c > maxVotes) { maxVotes = c; mostVotedTarget = t; }
      }

      const convictedNpc = game.npcs[mostVotedTarget];
      const convictedChar = convictedNpc
        ? script.characters.find((c) => c.id === convictedNpc.character_id)
        : null;
      const convictedName = convictedChar?.name || mostVotedTarget;

      const verdictPrompt = `投票结束！${convictedName} 获得了最高票数 ${maxVotes}/${totalPlayers}。请用 120-200 字揭晓这个结果，并判断玩家们是否找对了真凶。如果线索指向不一致，给予意味深长的暗示。`;
      const verdictResp = await router.chat(
        [{ role: "user", content: verdictPrompt }],
        {
          system: this.buildSystemPrompt(script, game),
          temperature: 0.8,
          maxTokens: 400,
        },
      );
      verdict = verdictResp.content;
      // 清理投票计数
      this.voteCounts.delete(game.id);
    }

    return {
      action: "vote",
      narrative: response.content,
      target_name: targetName,
      votes_count: votedCount,
      total_players: totalPlayers,
      verdict,
    };
  }

  private async handleSkill(
    action: PlayerAction,
    _script: Script,
    _game: GameState,
    player: PlayerState,
  ): Promise<Record<string, unknown>> {
    return {
      action: "skill",
      narrative: `${player.name} 使用了特殊技能。`,
      skill_content: action.content,
    };
  }

  async generateRecap(script: Script, game: GameState): Promise<string> {
    const playerSummary = Object.values(game.players)
      .map((p) => {
        const char = script.characters.find((c) => c.id === p.character_id);
        return `- ${p.name} 扮演 ${char?.name || "?"}，收集了 ${p.clue_ids.length} 条线索`;
      })
      .join("\n");

    const prompt = `请生成一份剧本杀复盘报告，包含以下内容：

剧本：${script.title}
故事概要：${script.summary}
完整时间线：${script.timeline}

玩家情况：
${playerSummary}

公开线索数：${game.revealed_clues.length}

格式要求（使用 Markdown 格式）：

## 🔎 故事真相还原
（用文学化语言描述整个事件的真相，500-800 字）

## 🔑 关键线索回顾
（列出 3-5 条最关键的线索，并说明它们如何串联起真相）

## 🎭 角色表现点评
（对每个角色的表现做简短点评）

## 📊 数据统计
- 总轮次：${game.current_round}/${script.rounds}
- 揭示线索：${game.revealed_clues.length}/${script.clues.length}
- 总参与玩家：${Object.keys(game.players).length} 人`;

    const response = await router.chat(
      [{ role: "user", content: prompt }],
      {
        system: this.buildSystemPrompt(script, game),
        temperature: 0.7,
        maxTokens: 2000,
      },
    );

    return response.content;
  }
}

export const gameMaster = new GameMaster();
