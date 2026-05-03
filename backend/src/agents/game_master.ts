/** Game Master：主持 Agent，控制游戏节奏和规则裁决。 */

import { router } from "../core/llm.js";
import type {
  Script, GameState, GamePhase, PlayerAction, PlayerState, Clue,
} from "../models/schemas.js";

export class GameMaster {
  private buildSystemPrompt(script: Script, game: GameState): string {
    return `你是一个剧本杀游戏的主持人（Game Master）。你负责控制游戏节奏、分发线索、裁决玩家行动。

## 当前剧本
- 标题：${script.title}
- 主题：${script.theme}
- 故事概要：${script.summary}

## 游戏状态
- 当前轮次：${game.current_round}/${script.rounds}
- 玩家数：${Object.keys(game.players).length}
- NPC数：${Object.keys(game.npcs).length}
- 阶段：${game.phase}

## 你的职责
1. 在每轮开始时进行剧情推进描述（100-200字，营造氛围）
2. 在玩家调查成功时，描述他们发现的线索
3. 在僵局时投放提示（但不直接揭示真相）
4. 管理投票环节，宣布结果
5. 确保游戏不跑偏，玩家行为符合角色设定

## 行为准则
- 保持中立，不偏袒任何一方
- 不要透露剧本的核心秘密或凶手身份
- 用文学化的语言描述场景和事件
- 线索分发要有节奏感，不要一次性给太多
- 当玩家做出精彩推理时，给予适当的氛围反馈`;
  }

  getRoundIntro(script: Script, game: GameState): string {
    return `[Game Master] 第 ${game.current_round} 轮开始——`;
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
        return this.handleVote(action, script, game);
      case "use_skill":
        return this.handleSkill(action, script, game, player);
      default:
        return { error: `未知行动类型: ${action.action_type}`, narrative: "" };
    }
  }

  private async handleInvestigate(
    _action: PlayerAction,
    script: Script,
    game: GameState,
    player: PlayerState,
  ): Promise<Record<string, unknown>> {
    const available = script.clues.filter(
      (c) =>
        !game.revealed_clues.includes(c.id) &&
        c.reveal_round <= game.current_round,
    );

    if (available.length === 0) {
      return {
        action: "investigate",
        narrative: "[GM] 你仔细搜查了现场，但暂时没有发现新的线索。",
        clue: null,
      };
    }

    const clue = available[0];
    game.revealed_clues.push(clue.id);
    player.clue_ids.push(clue.id);

    const response = await router.chat(
      [
        {
          role: "user",
          content: `玩家在调查中发现了线索：${clue.name}（${clue.description}）。请用 100-200 字的文学化语言描述这个发现过程。`,
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
      clue: { ...clue },
    };
  }

  private async handleVote(
    action: PlayerAction,
    _script: Script,
    _game: GameState,
  ): Promise<Record<string, unknown>> {
    return {
      action: "vote",
      narrative: `[GM] ${action.player_id} 投出了关键的一票...`,
      target_id: action.target_id,
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
      narrative: `[GM] ${player.name} 使用了特殊技能。`,
      skill_content: action.content,
    };
  }

  async generateRecap(script: Script, game: GameState): Promise<string> {
    const prompt = `请生成一份剧本杀复盘报告，包含以下内容：

剧本：${script.title}
故事概要：${script.summary}
公开线索数：${game.revealed_clues.length}

格式要求：
1. 故事真相还原（用文学化语言描述整个事件的真相）
2. 关键线索回顾
3. 角色表现点评

总计 500-800 字。`;

    const response = await router.chat(
      [{ role: "user", content: prompt }],
      {
        system: this.buildSystemPrompt(script, game),
        temperature: 0.7,
        maxTokens: 1500,
      },
    );

    return response.content;
  }
}

export const gameMaster = new GameMaster();
