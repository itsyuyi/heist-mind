import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useGameStore } from '../stores/gameStore';
import type { GameState, Script, CharacterCard, NPCState, ActionResult } from '../types';

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { currentPlayer, setCurrentGame, addMessage } = useGameStore();

  const [game, setGame] = useState<GameState | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showClues, setShowClues] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const playerId = currentPlayer?.id || '';

  // 轮询游戏状态
  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const g = await api.getGame(gameId);
      setGame(g);
      if (game?.phase !== g.phase) {
        addMessage({ speaker: '系统', content: `游戏阶段变更：${g.phase}`, type: 'system' });
      }
    } catch (e) {
      console.error(e);
    }
  }, [gameId, game?.phase, addMessage]);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const g = await api.getGame(gameId);
        setGame(g);
        const s = await api.getScript(g.script_id);
        setScript(s);
        setCurrentGame(g);
        addMessage({ speaker: 'Game Master', content: `欢迎进入《${s.title}》。第 ${g.current_round} 轮，游戏开始！`, type: 'gm' });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [game?.chat_history]);

  const handleAction = async (actionType: string) => {
    if (!input.trim() || !gameId || acting) return;
    setActing(true);
    const content = input;
    setInput('');

    addMessage({ speaker: currentPlayer?.name || '你', content, type: 'player' });

    try {
      const result: ActionResult = await api.playerAction(gameId, playerId, actionType, content);

      if (result.narrative) {
        addMessage({ speaker: 'Game Master', content: result.narrative, type: 'gm' });
      }
      if (result.clue) {
        addMessage({ speaker: '🔍 线索', content: `【${result.clue.name}】${result.clue.description}`, type: 'clue' });
      }
      if (result.npc_response) {
        addMessage({ speaker: 'NPC', content: result.npc_response, type: 'npc' });
      }
      if (result.error) {
        addMessage({ speaker: '系统', content: result.error, type: 'error' });
      }
    } catch (e: unknown) {
      addMessage({ speaker: '系统', content: e instanceof Error ? e.message : '操作失败', type: 'error' });
    } finally {
      setActing(false);
    }
  };

  const handleNextRound = async () => {
    if (!gameId) return;
    try {
      const r = await api.nextRound(gameId);
      addMessage({ speaker: 'Game Master', content: r.intro || `进入第 ${r.round} 轮`, type: 'gm' });
      await fetchGame();
    } catch (e: unknown) {
      addMessage({ speaker: '系统', content: e instanceof Error ? e.message : '操作失败', type: 'error' });
    }
  };

  const handleEndGame = async () => {
    if (!gameId) return;
    try {
      const r = await api.endGame(gameId);
      addMessage({ speaker: 'Game Master', content: r.recap || '', type: 'gm' });
    } catch (e: unknown) {
      addMessage({ speaker: '系统', content: e instanceof Error ? e.message : '操作失败', type: 'error' });
    }
  };

  if (loading) return <div style={styles.loading}>加载中...</div>;
  if (!game || !script) return <div style={styles.loading}>游戏不存在</div>;

  const myChar = script.characters.find((c: CharacterCard) => c.id === currentPlayer?.character_id);
  const npcList = Object.values(game.npcs || {});

  return (
    <div style={styles.container}>
      {/* 侧边栏 */}
      <div style={styles.sidebar}>
        <div style={styles.sidePanel}>
          <h3 style={styles.panelTitle}>🎭 我的角色</h3>
          {myChar && (
            <>
              <p style={styles.charName}>{myChar.name}</p>
              <p style={styles.charInfo}>{myChar.occupation} · {myChar.gender} · {myChar.age}岁</p>
              <details style={styles.details}>
                <summary style={styles.summary}>📖 背景故事</summary>
                <p style={styles.detailText}>{myChar.background}</p>
              </details>
              <details style={styles.details}>
                <summary style={styles.summary}>🤫 核心秘密</summary>
                <p style={styles.detailText}>{myChar.secret}</p>
              </details>
              <details style={styles.details}>
                <summary style={styles.summary}>🎯 行动目标</summary>
                <p style={styles.detailText}>{myChar.goal}</p>
              </details>
            </>
          )}
        </div>

        <div style={styles.sidePanel}>
          <h3 style={styles.panelTitle}>👥 在场 NPC</h3>
          {npcList.map((npc: NPCState) => {
            const char = script.characters.find((c: CharacterCard) => c.id === npc.character_id);
            return char ? (
              <div key={npc.id} style={styles.npcItem}>
                {char.name} <span style={styles.npcMood}>({npc.mood})</span>
              </div>
            ) : null;
          })}
        </div>

        <div style={styles.sidePanel}>
          <button onClick={() => setShowClues(!showClues)} style={styles.clueBtn}>
            {showClues ? '🔽 隐藏' : '🔎 查看'}线索手册 ({currentPlayer?.clue_ids?.length || 0})
          </button>
          {showClues && (
            <div style={styles.clueList}>
              {(currentPlayer?.clue_ids || []).map((cid: string) => {
                const clue = script.clues.find((c) => c.id === cid);
                return clue ? (
                  <div key={cid} style={styles.clueItem}>
                    <strong>{clue.name}</strong>
                    <p style={styles.clueDesc}>{clue.description}</p>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* 主区域 */}
      <div style={styles.main}>
        <div style={styles.header}>
          <h2 style={styles.gameTitle}>{script.title}</h2>
          <span style={styles.round}>第 {game.current_round}/{script.rounds} 轮 · {game.phase}</span>
          <div style={styles.headerBtns}>
            {game.phase === 'playing' && (
              <button onClick={handleNextRound} style={styles.roundBtn}>▶ 下一轮</button>
            )}
            {game.phase === 'voting' && (
              <button onClick={handleEndGame} style={styles.endBtn}>🏁 结束投票</button>
            )}
            {game.phase === 'playing' && (
              <button onClick={handleEndGame} style={styles.endBtn}>🏁 结束游戏</button>
            )}
          </div>
        </div>

        <div style={styles.chatArea}>
          <div style={styles.messages}>
            {game.chat_history.map((entry: Record<string, unknown>, i: number) => (
              <div key={i} style={{
                ...styles.msg,
                ...(entry.player_id === playerId ? styles.msgMine : {}),
              }}>
                <span style={styles.msgSpeaker}>
                  {script.characters.find((c: CharacterCard) => c.id === currentPlayer?.character_id)?.name || '玩家'}
                </span>
                <span style={styles.msgContent}>{String(entry.content || '')}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.inputArea}>
            <div style={styles.actions}>
              <button onClick={() => handleAction('talk')} disabled={acting} style={styles.actionBtn}>
                💬 对话
              </button>
              <button onClick={() => handleAction('investigate')} disabled={acting} style={styles.actionBtn}>
                🔍 调查
              </button>
              <button onClick={() => handleAction('vote')} disabled={acting} style={styles.actionBtn}>
                🗳️ 投票
              </button>
            </div>
            <div style={styles.inputRow}>
              <input
                style={styles.chatInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAction('talk')}
                placeholder="输入你想说的话..."
                disabled={acting}
              />
              <button
                onClick={() => handleAction('talk')}
                disabled={acting || !input.trim()}
                style={styles.sendBtn}
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', height: '100vh', background: '#0c0c1d' },
  loading: { color: '#fff', textAlign: 'center', paddingTop: '40vh', fontSize: 18 },
  sidebar: {
    width: 280, background: 'rgba(255,255,255,0.03)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
  },
  sidePanel: { padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' },
  panelTitle: { color: '#667eea', fontSize: 14, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase' as const },
  charName: { color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 },
  charInfo: { color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 8px' },
  details: { marginTop: 4 },
  summary: { color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' },
  detailText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5, margin: '4px 0 0 12px', maxHeight: 120, overflowY: 'auto' as const },
  npcItem: { color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: '4px 0' },
  npcMood: { fontSize: 11, opacity: 0.6 },
  clueBtn: {
    width: '100%', padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer',
  },
  clueList: { marginTop: 8 },
  clueItem: { padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  clueDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  header: {
    padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const,
  },
  gameTitle: { color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 },
  round: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  headerBtns: { display: 'flex', gap: 8, marginLeft: 'auto' },
  roundBtn: {
    padding: '8px 16px', borderRadius: 10, border: '1px solid #667eea',
    background: 'transparent', color: '#667eea', fontSize: 13, cursor: 'pointer',
  },
  endBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: '#e74c3c', color: '#fff', fontSize: 13, cursor: 'pointer',
  },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  messages: {
    flex: 1, overflowY: 'auto', padding: 24,
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  msg: { padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', maxWidth: '80%', alignSelf: 'flex-start' },
  msgMine: { background: 'rgba(102,126,234,0.15)', alignSelf: 'flex-end' },
  msgSpeaker: { color: '#667eea', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 2 },
  msgContent: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.5 },
  inputArea: { padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  actions: { display: 'flex', gap: 8, marginBottom: 8 },
  actionBtn: {
    padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer',
  },
  inputRow: { display: 'flex', gap: 8 },
  chatInput: {
    flex: 1, padding: '12px 16px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
    color: '#fff', fontSize: 14, outline: 'none',
  },
  sendBtn: {
    padding: '12px 24px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};
