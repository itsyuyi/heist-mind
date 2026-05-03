import { create } from 'zustand';
import type { Script, GameState, PlayerState } from '../types';

interface GameStore {
  // 剧本
  scripts: Script[];
  loadingScripts: boolean;
  loadScripts: () => Promise<void>;

  // 游戏
  currentGame: GameState | null;
  currentPlayer: PlayerState | null;
  setCurrentGame: (game: GameState | null) => void;
  setCurrentPlayer: (player: PlayerState | null) => void;

  // 聊天
  messages: { speaker: string; content: string; type: string }[];
  addMessage: (msg: { speaker: string; content: string; type: string }) => void;
  clearMessages: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  scripts: [],
  loadingScripts: false,

  loadScripts: async () => {
    set({ loadingScripts: true });
    try {
      const { api } = await import('../services/api');
      const scripts = await api.listScripts();
      set({ scripts });
    } catch (e) {
      console.error('加载剧本失败', e);
    } finally {
      set({ loadingScripts: false });
    }
  },

  currentGame: null,
  currentPlayer: null,
  setCurrentGame: (game) => set({ currentGame: game }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
}));
