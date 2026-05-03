export interface ScriptTheme {
  value: string;
  label: string;
}

export interface CharacterCard {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  background: string;
  personality: string;
  secret: string;
  goal: string;
  relationships: Record<string, string>;
  avatar_prompt: string;
}

export interface Clue {
  id: string;
  name: string;
  type: 'physical' | 'testimony' | 'timeline' | 'motive';
  description: string;
  source_npc_id: string | null;
  reveal_round: number;
  connections: string[];
}

export interface Script {
  id: string;
  title: string;
  theme: string;
  player_count: number;
  summary: string;
  characters: CharacterCard[];
  clues: Clue[];
  timeline: string;
  endings: string[];
  npc_count: number;
  rounds: number;
  estimated_tokens: number;
}

export interface PlayerState {
  id: string;
  name: string;
  character_id: string;
  notes: string;
  clue_ids: string[];
  is_alive: boolean;
  is_ready: boolean;
}

export interface NPCState {
  id: string;
  character_id: string;
  mood: string;
  strategy: string;
  memory: Record<string, unknown>[];
  trust_scores: Record<string, number>;
}

export interface GameState {
  id: string;
  script_id: string;
  phase: 'waiting' | 'intro' | 'playing' | 'voting' | 'ended';
  current_round: number;
  players: Record<string, PlayerState>;
  npcs: Record<string, NPCState>;
  revealed_clues: string[];
  chat_history: Record<string, unknown>[];
  game_master_notes: string;
  total_tokens_used: number;
}

export interface ActionResult {
  player_id: string;
  action_type: string;
  narrative?: string;
  clue?: Clue;
  npc_response?: string;
  error?: string;
  target_name?: string;
  votes_count?: number;
  total_players?: number;
  verdict?: string;
  all_voted?: boolean;
  [key: string]: unknown;
}
