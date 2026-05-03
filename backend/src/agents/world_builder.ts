/** 剧本工坊：基于 MiMo 推理模型自动生成完整剧本包。 */

import { v4 as uuid } from "uuid";
import { router } from "../core/llm.js";
import type { ScriptTheme, Script, CreateScriptRequest } from "../models/schemas.js";
import { CharacterCard, Clue } from "../models/schemas.js";

const THEME_PROMPTS: Record<ScriptTheme, string> = {
  republican_spy:
    "民国谍战风格，背景设定在 1930-1940 年代的中国。" +
    "角色包括地下党员、军统特工、日本间谍、商界名流、报社记者等。" +
    "核心矛盾围绕情报争夺、身份伪装、组织背叛展开。" +
    "氛围：暗流涌动、危机四伏、信仰与背叛的交织。",
  cyberpunk:
    "赛博朋克风格，近未来反乌托邦设定。" +
    "角色包括黑客、企业特工、义体医生、街头情报贩子、AI 意识体等。" +
    "核心矛盾围绕数据战争、企业阴谋、人机伦理展开。" +
    "氛围：霓虹灯下的黑暗、科技与人性的撕裂。",
  japanese_honkaku:
    "日式本格推理风格，注重逻辑解谜和诡计设计。" +
    "设定在封闭空间（孤岛、暴风雪山庄、密室等）。" +
    "角色包括侦探、嫌疑人、目击者、法医、刑警等。" +
    "核心矛盾围绕密室杀人、不在场证明、叙述性诡计展开。" +
    "氛围：冷静克制下的暗涌、精密的逻辑之美。",
};

export class WorldBuilder {
  private buildGenerationPrompt(req: CreateScriptRequest): string {
    const themeDesc = THEME_PROMPTS[req.theme] || "";
    const extra = req.extra_requirements ? `\n额外要求：${req.extra_requirements}` : "";
    const titleHint = req.title ? `剧本标题：${req.title}` : "请生成一个吸引人的剧本标题";

    return `你是一个顶级的剧本杀编剧。请生成一个完整的${req.player_count}人剧本杀剧本包。

风格：${themeDesc}${extra}
${titleHint}

请严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记）：

{
  "title": "剧本标题",
  "summary": "300字故事梗概",
  "timeline": "完整时间线描述，包含矛盾点",
  "endings": ["结局1描述", "结局2描述", "结局3描述"],
  "characters": [
    {
      "id": "char_1",
      "name": "角色名",
      "age": 28,
      "gender": "男/女",
      "occupation": "职业",
      "background": "2000字以上背景故事，包含成长经历、关键事件、人际关系",
      "personality": "性格特征描述",
      "secret": "该角色不可告人的核心秘密",
      "goal": "该角色在剧本中的行动目标",
      "relationships": {"char_2": "与char_2的关系描述"},
      "avatar_prompt": "用于生成角色立绘的英文prompt"
    }
  ],
  "clues": [
    {
      "id": "clue_1",
      "name": "线索名称",
      "type": "physical/testimony/timeline/motive",
      "description": "详细线索描述",
      "source_npc_id": "char_1",
      "reveal_round": 1,
      "connections": ["clue_2"]
    }
  ]
}

要求：
- 角色数 = ${req.player_count}，每个角色背景必须超过2000字
- 线索至少 ${req.player_count * 3} 条，分布在 3-5 轮
- 必须有一个核心谜题（谁是凶手/内鬼/叛徒）
- 故事必须逻辑自洽，时间线不能有漏洞
- 角色关系必须完整，每个角色至少与2个其他角色有关系
- 至少3个不同结局`;
  }

  async generateScript(req: CreateScriptRequest): Promise<Script> {
    const prompt = this.buildGenerationPrompt(req);
    const response = await router.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.9, maxTokens: 16384 },
    );

    let content = response.content.trim();
    // 清理 markdown 标记
    if (content.startsWith("```")) {
      const lines = content.split("\n");
      content = lines.slice(1, lines[lines.length - 1]?.trim() === "```" ? -1 : undefined).join("\n");
    }

    const data = JSON.parse(content);
    const scriptId = `script_${uuid().slice(0, 12)}`;

    const characters = data.characters.map((c: unknown) => CharacterCard.parse(c));
    const clues = data.clues.map((c: unknown) => Clue.parse(c));

    // 估算 Token 数
    let totalText = data.summary + data.timeline;
    for (const c of data.characters) {
      totalText += (c.background || "") + (c.personality || "") + (c.secret || "");
    }
    for (const c of data.clues) {
      totalText += c.description || "";
    }
    const estimatedTokens = Math.floor(totalText.length / 2) + response.usage.totalTokens;

    return {
      id: scriptId,
      title: data.title,
      theme: req.theme,
      player_count: req.player_count,
      summary: data.summary,
      characters,
      clues,
      timeline: data.timeline,
      endings: data.endings,
      npc_count: req.player_count,
      rounds: 5,
      estimated_tokens: estimatedTokens,
    };
  }
}

export const worldBuilder = new WorldBuilder();
