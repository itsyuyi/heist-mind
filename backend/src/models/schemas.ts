import { z } from "zod";

// --- 枚举 ---
export const ScriptTheme = z.enum(["republican_spy", "cyberpunk", "japanese_honkaku"]);
export type ScriptTheme = z.infer<typeof ScriptTheme>;

export const NPCStrategy = z.enum(["honest", "evasive", "misdirect", "counter"]);
export type NPCStrategy = z.infer<typeof NPCStrategy>;

export const NPCMood = z.enum(["trust", "suspicion", "fear", "anger", "calm", "nervous"]);
export type NPCMood = z.infer<typeof NPCMood>;

export const ClueType = z.enum(["physical", "testimony", "timeline", "motive"]);
export type ClueType = z.infer<typeof ClueType>;

export const GamePhase = z.enum(["waiting", "intro", "playing", "voting", "ended"]);
export type GamePhase = z.infer<typeof GamePhase>;

// --- 角色 ---
export const CharacterCard = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  gender: z.string(),
  occupation: z.string(),
  background: z.string(),
  personality: z.string(),
  secret: z.string(),
  goal: z.string(),
  relationships: z.record(z.string(), z.string()).default({}),
  avatar_prompt: z.string().default(""),
});
export type CharacterCard = z.infer<typeof CharacterCard>;

// --- 线索 ---
export const Clue = z.object({
  id: z.string(),
  name: z.string(),
  type: ClueType,
  description: z.string(),
  source_npc_id: z.string().nullable().default(null),
  reveal_round: z.number().default(1),
  connections: z.array(z.string()).default([]),
});
export type Clue = z.infer<typeof Clue>;

// --- 剧本 ---
export const Script = z.object({
  id: z.string(),
  title: z.string(),
  theme: ScriptTheme,
  player_count: z.number(),
  summary: z.string(),
  characters: z.array(CharacterCard),
  clues: z.array(Clue),
  timeline: z.string(),
  endings: z.array(z.string()),
  npc_count: z.number(),
  rounds: z.number().default(5),
  estimated_tokens: z.number().default(0),
});
export type Script = z.infer<typeof Script>;

// --- 游戏状态 ---
export const PlayerState = z.object({
  id: z.string(),
  name: z.string(),
  character_id: z.string(),
  notes: z.string().default(""),
  clue_ids: z.array(z.string()).default([]),
  is_alive: z.boolean().default(true),
  is_ready: z.boolean().default(false),
});
export type PlayerState = z.infer<typeof PlayerState>;

export const NPCState = z.object({
  id: z.string(),
  character_id: z.string(),
  mood: NPCMood.default("calm"),
  strategy: NPCStrategy.default("honest"),
  memory: z.array(z.record(z.unknown())).default([]),
  trust_scores: z.record(z.string(), z.number()).default({}),
});
export type NPCState = z.infer<typeof NPCState>;

export const GameState = z.object({
  id: z.string(),
  script_id: z.string(),
  phase: GamePhase.default("waiting"),
  current_round: z.number().default(1),
  players: z.record(z.string(), PlayerState).default({}),
  npcs: z.record(z.string(), NPCState).default({}),
  revealed_clues: z.array(z.string()).default([]),
  chat_history: z.array(z.record(z.unknown())).default([]),
  game_master_notes: z.string().default(""),
  total_tokens_used: z.number().default(0),
});
export type GameState = z.infer<typeof GameState>;

// --- API 请求 ---
export const CreateScriptRequest = z.object({
  theme: ScriptTheme,
  player_count: z.number().min(4).max(10),
  title: z.string().optional(),
  extra_requirements: z.string().optional(),
});
export type CreateScriptRequest = z.infer<typeof CreateScriptRequest>;

export const CreateGameRequest = z.object({
  script_id: z.string(),
});
export type CreateGameRequest = z.infer<typeof CreateGameRequest>;

export const JoinGameRequest = z.object({
  game_id: z.string().optional(),
  player_name: z.string(),
  character_id: z.string(),
});
export type JoinGameRequest = z.infer<typeof JoinGameRequest>;

export const PlayerAction = z.object({
  game_id: z.string().optional(),
  player_id: z.string(),
  action_type: z.string(),
  target_id: z.string().optional(),
  content: z.string(),
});
export type PlayerAction = z.infer<typeof PlayerAction>;

// 主题中文标签
export const THEME_LABELS: Record<ScriptTheme, string> = {
  republican_spy: "民国谍战",
  cyberpunk: "赛博朋克",
  japanese_honkaku: "日式本格",
};
