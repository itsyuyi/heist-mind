import type { Script, GameState, PlayerState, ActionResult } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

async function request<R>(path: string, options?: RequestInit): Promise<R> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

interface ScriptThemeItem { value: string; label: string }

export const api = {
  listThemes: () => request<ScriptThemeItem[]>('/themes'),

  generateScript: (theme: string, playerCount: number, title?: string, extra?: string): Promise<Script> =>
    request('/scripts/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, player_count: playerCount, title, extra_requirements: extra }),
    }),

  listScripts: (): Promise<Script[]> => request('/scripts'),

  getScript: (id: string): Promise<Script> => request(`/scripts/${id}`),

  createGame: (scriptId: string): Promise<GameState> =>
    request('/games', {
      method: 'POST',
      body: JSON.stringify({ script_id: scriptId }),
    }),

  joinGame: (gameId: string, playerName: string, characterId: string): Promise<PlayerState> =>
    request(`/games/${gameId}/join`, {
      method: 'POST',
      body: JSON.stringify({ player_name: playerName, character_id: characterId }),
    }),

  getGame: (gameId: string): Promise<GameState> => request(`/games/${gameId}`),

  startGame: (gameId: string): Promise<GameState> =>
    request(`/games/${gameId}/start`, { method: 'POST' }),

  playerAction: (gameId: string, playerId: string, actionType: string, content: string, targetId?: string): Promise<ActionResult> =>
    request(`/games/${gameId}/action`, {
      method: 'POST',
      body: JSON.stringify({
        player_id: playerId,
        action_type: actionType,
        content,
        target_id: targetId,
      }),
    }),

  nextRound: (gameId: string): Promise<{ phase: string; round?: number; intro?: string }> =>
    request(`/games/${gameId}/next-round`, { method: 'POST' }),

  endGame: (gameId: string): Promise<{ phase: string; recap?: string }> =>
    request(`/games/${gameId}/end`, { method: 'POST' }),
};
