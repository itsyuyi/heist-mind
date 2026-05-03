import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useGameStore } from '../stores/gameStore';
import type { GameState, Script, CharacterCard, NPCState, ActionResult } from '../types';

type ActionType = 'talk' | 'investigate' | 'vote';

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentPlayer, setCurrentGame, addMessage, messages, clearMessages } = useGameStore();

  const [game, setGame] = useState<GameState | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showClues, setShowClues] = useState(false);
  const [endResult, setEndResult] = useState<string | null>(null);

  // 行动模式
  const [activeAction, setActiveAction] = useState<ActionType>('talk');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const playerId = currentPlayer?.id || '';

  // 轮询游戏状态
  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const g = await api.getGame(gameId);
      setGame(g);
      setCurrentGame(g);

      // 检测阶段变化
      if (g.phase === 'ended' && !endResult) {
        // 获取复盘
        try {
          const r = await api.endGame(gameId);
          setEndResult(r.recap || '游戏结束');
        } catch { /* 复盘可能已经在 endGame 中生成 */ }
      }
    } catch (e) {
      console.error(e);
    }
  }, [gameId, setCurrentGame, endResult]);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const g = await api.getGame(gameId);
        setGame(g);
        const s = await api.getScript(g.script_id);
        setScript(s);
        setCurrentGame(g);

        if (g.phase === 'ended') {
          try {
            const r = await api.endGame(gameId);
            setEndResult(r.recap || '游戏结束');
          } catch { /* */ }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    const interval = setInterval(fetchGame, 3000);
    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, game?.chat_history]);

  const handleAction = async () => {
    if (!input.trim() || !gameId || acting) return;
    if (activeAction !== 'investigate' && !selectedTarget) {
      setShowTargetPicker(true);
      return;
    }

    setActing(true);
    const content = input;
    setInput('');

    addMessage({
      speaker: currentPlayer?.name || '你',
      content: `${actionLabel(activeAction)} → ${targetLabel()}: ${content}`,
      type: 'player',
    });

    try {
      const result: ActionResult = await api.playerAction(
        gameId, playerId, activeAction, content, selectedTarget || undefined,
      );

      if (result.narrative) {
        addMessage({ speaker: '🎲 Game Master', content: result.narrative, type: 'gm' });
      }
      if (result.clue) {
        addMessage({
          speaker: '🔍 新线索',
          content: `【${result.clue.name}】${result.clue.description}`,
          type: 'clue',
        });
        // 刷新游戏以更新 clue_ids
        await fetchGame();
      }
      if (result.npc_response) {
        addMessage({ speaker: `👤 ${targetLabel()}`, content: result.npc_response, type: 'npc' });
      }
      if (result.error) {
        addMessage({ speaker: '⚠️ 系统', content: result.error, type: 'error' });
      }

      // 投票结果
      if (result.verdict) {
        addMessage({ speaker: '⚖️ 投票揭晓', content: String(result.verdict), type: 'gm' });
      }
      if (result.votes_count !== undefined) {
        addMessage({
          speaker: '🗳️ 投票进度',
          content: `已有 ${result.votes_count}/${result.total_players} 人投票`,
          type: 'system',
        });
      }

      // 检查蝴蝶效应
      for (const key of Object.keys(result)) {
        if (key.startsWith('butterfly_')) {
          const name = key.replace('butterfly_', '');
          addMessage({
            speaker: `🦋 ${name}`,
            content: String(result[key]),
            type: 'npc',
          });
        }
      }
    } catch (e: unknown) {
      addMessage({
        speaker: '⚠️ 系统',
        content: e instanceof Error ? e.message : '操作失败',
        type: 'error',
      });
    } finally {
      setActing(false);
      setSelectedTarget('');
      setActiveAction('talk');
    }
  };

  const actionLabel = (a: ActionType) => {
    switch (a) { case 'talk': return '对话'; case 'investigate': return '调查'; case 'vote': return '投票'; }
  };

  const targetLabel = () => {
    if (activeAction === 'investigate') return '案发现场';
    const char = script?.characters.find((c: CharacterCard) => {
      const npcId = game?.npcs ? Object.entries(game.npcs).find(
        ([, v]) => v.character_id === c.id && v.id === selectedTarget,
      )?.[0] : undefined;
      return npcId === selectedTarget || c.id === selectedTarget;
    });
    return char?.name || selectedTarget || '未选择';
  };

  const handleNextRound = async () => {
    if (!gameId) return;
    try {
      const r = await api.nextRound(gameId);
      addMessage({
        speaker: '🎲 Game Master',
        content: r.intro || `进入第 ${r.round} 轮`,
        type: 'gm',
      });
      await fetchGame();
    } catch (e: unknown) {
      addMessage({
        speaker: '⚠️ 系统',
        content: e instanceof Error ? e.message : '操作失败',
        type: 'error',
      });
    }
  };

  const handleEndGame = async () => {
    if (!gameId) return;
    try {
      const r = await api.endGame(gameId);
      setEndResult(r.recap || '游戏结束');
      await fetchGame();
    } catch (e: unknown) {
      addMessage({
        speaker: '⚠️ 系统',
        content: e instanceof Error ? e.message : '操作失败',
        type: 'error',
      });
    }
  };

  const handleBackToHome = () => {
    clearMessages();
    navigate('/');
  };

  if (loading) return <div style={styles.loading}>⏳ 加载中...</div>;
  if (!game || !script) return <div style={styles.loading}>❌ 游戏不存在</div>;
  if (!currentPlayer) return <div style={styles.loading}>❌ 请先加入游戏</div>;

  const myChar = script.characters.find(
    (c: CharacterCard) => c.id === currentPlayer.character_id,
  );
  const npcList = Object.entries(game.npcs || {}).filter(
    ([, npc]) => npc.character_id !== currentPlayer.character_id,
  );

  // 获取可选目标列表
  const getTargets = () => {
    if (activeAction === 'investigate') return [{ id: 'scene', label: '🔍 调查案发现场' }];
    if (activeAction === 'vote') {
      return npcList.map(([npcId, npc]) => {
        const char = script.characters.find((c: CharacterCard) => c.id === npc.character_id);
        return { id: npcId, label: `🗳️ ${char?.name || npcId}` };
      });
    }
    return npcList.map(([npcId, npc]) => {
      const char = script.characters.find((c: CharacterCard) => c.id === npc.character_id);
      return { id: npcId, label: `💬 ${char?.name || npcId} (${char?.occupation || ''})` };
    });
  };

  // 游戏结束界面
  if (game.phase === 'ended' && endResult) {
    return (
      <div style={styles.endContainer}>
        <div style={styles.endCard}>
          <h1 style={styles.endTitle}>🎭 游戏结束</h1>
          <h2 style={styles.endScriptTitle}>{script.title}</h2>
          <div style={styles.endRecap}>{endResult}</div>
          <button onClick={handleBackToHome} style={styles.endBtn}>
            🏠 返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 侧边栏 */}
      <div style={styles.sidebar}>
        {myChar && (
          <div style={styles.sidePanel}>
            <h3 style={styles.panelTitle}>🎭 我的角色</h3>
            <p style={styles.charName}>{myChar.name}</p>
            <p style={styles.charInfo}>
              {myChar.occupation} · {myChar.gender} · {myChar.age}岁
            </p>
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
          </div>
        )}

        <div style={styles.sidePanel}>
          <h3 style={styles.panelTitle}>👥 在场角色</h3>
          {npcList.map(([npcId, npc]) => {
            const char = script.characters.find(
              (c: CharacterCard) => c.id === npc.character_id,
            );
            return char ? (
              <div key={npcId} style={styles.npcItem}>
                <span>{char.name}</span>
                <span style={styles.npcOcc}>{char.occupation}</span>
                <span style={{
                  ...styles.npcMood,
                  color: moodColor(npc.mood),
                }}>({npc.mood})</span>
              </div>
            ) : null;
          })}
        </div>

        <div style={styles.sidePanel}>
          <button onClick={() => setShowClues(!showClues)} style={styles.clueBtn}>
            {showClues ? '🔽 收起' : '🔎 展开'}线索手册 ({currentPlayer?.clue_ids?.length || 0})
          </button>
          {showClues && (
            <div style={styles.clueList}>
              {(currentPlayer?.clue_ids || []).length === 0 ? (
                <p style={styles.noClue}>暂无线索，快去调查吧！</p>
              ) : (
                (currentPlayer?.clue_ids || []).map((cid: string) => {
                  const clue = script.clues.find((c) => c.id === cid);
                  return clue ? (
                    <div key={cid} style={styles.clueItem}>
                      <strong style={{ color: '#667eea' }}>{clue.name}</strong>
                      <p style={styles.clueDesc}>{clue.description}</p>
                    </div>
                  ) : null;
                })
              )}
            </div>
          )}
        </div>

        <div style={styles.sidePanel}>
          <h3 style={styles.panelTitle}>📊 游戏信息</h3>
          <p style={styles.infoText}>回合：{game.current_round}/{script.rounds}</p>
          <p style={styles.infoText}>阶段：{phaseLabel(game.phase)}</p>
          <p style={styles.infoText}>在场玩家：{Object.keys(game.players).length}</p>
        </div>

        <button onClick={handleBackToHome} style={styles.leaveBtn}>
          🚪 离开房间
        </button>
      </div>

      {/* 主区域 */}
      <div style={styles.main}>
        <div style={styles.header}>
          <h2 style={styles.gameTitle}>{script.title}</h2>
          <span style={styles.round}>
            第 {game.current_round}/{script.rounds} 轮 · {phaseLabel(game.phase)}
          </span>
          <div style={styles.headerBtns}>
            {game.phase === 'playing' && (
              <button onClick={handleNextRound} style={styles.roundBtn}>
                ⏭️ 下一轮
              </button>
            )}
            {(game.phase === 'playing' || game.phase === 'voting') && (
              <button onClick={handleEndGame} style={styles.endBtn}>
                🏁 结束游戏
              </button>
            )}
          </div>
        </div>

        {/* 消息区 */}
        <div style={styles.chatArea}>
          <div style={styles.messages}>
            {messages.length === 0 && !game.chat_history?.length && (
              <div style={styles.emptyChat}>
                <p style={{ fontSize: 24 }}>🎬</p>
                <p>游戏开始！选择行动方式，开始你的推理之旅...</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...styles.msg,
                  ...(msg.type === 'player' ? styles.msgMine : {}),
                  ...(msg.type === 'gm' ? styles.msgGM : {}),
                  ...(msg.type === 'clue' ? styles.msgClue : {}),
                  ...(msg.type === 'error' ? styles.msgError : {}),
                }}
              >
                <span style={styles.msgSpeaker}>{msg.speaker}</span>
                <span style={styles.msgContent}>{msg.content}</span>
              </div>
            ))}

            {/* 聊天历史 */}
            {game.chat_history?.map((entry: Record<string, unknown>, i: number) => {
              const isPlayerAction = entry.player_id === playerId || entry.action_type === 'talk';
              const char = script.characters.find(
                (c: CharacterCard) => c.id === currentPlayer.character_id,
              );
              return (
                <div
                  key={`h-${i}`}
                  style={{
                    ...styles.msg,
                    ...(isPlayerAction ? styles.msgMine : {}),
                  }}
                >
                  <span style={styles.msgSpeaker}>
                    {isPlayerAction ? char?.name || '你' : 'NPC'}
                  </span>
                  <span style={styles.msgContent}>{String(entry.content || '')}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div style={styles.inputArea}>
            {/* 行动选择 */}
            <div style={styles.actions}>
              <button
                onClick={() => { setActiveAction('talk'); setSelectedTarget(''); setShowTargetPicker(false); }}
                disabled={acting}
                style={{
                  ...styles.actionBtn,
                  ...(activeAction === 'talk' ? styles.actionBtnActive : {}),
                }}
              >
                💬 对话
              </button>
              <button
                onClick={() => { setActiveAction('investigate'); setSelectedTarget('scene'); setShowTargetPicker(false); }}
                disabled={acting}
                style={{
                  ...styles.actionBtn,
                  ...(activeAction === 'investigate' ? styles.actionBtnActive : {}),
                }}
              >
                🔍 调查
              </button>
              <button
                onClick={() => { setActiveAction('vote'); setSelectedTarget(''); setShowTargetPicker(false); }}
                disabled={acting}
                style={{
                  ...styles.actionBtn,
                  ...(activeAction === 'vote' ? styles.actionBtnActive : {}),
                }}
              >
                🗳️ 投票
              </button>
            </div>

            {/* 目标选择 */}
            {activeAction !== 'investigate' && (
              <div style={styles.targetRow}>
                <span style={styles.targetLabel}>
                  {activeAction === 'vote' ? '投票对象：' : '对话对象：'}
                </span>
                <div style={styles.targetList}>
                  {getTargets().map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTarget(t.id)}
                      style={{
                        ...styles.targetBtn,
                        ...(selectedTarget === t.id ? styles.targetBtnActive : {}),
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 输入框 */}
            <div style={styles.inputRow}>
              <input
                style={styles.chatInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                placeholder={
                  acting ? '正在处理...' :
                  activeAction === 'investigate' ? '描述你想调查的地方或方式...' :
                  activeAction === 'vote' ? '说明你的投票理由...' :
                  `对 ${targetLabel()} 说点什么...`
                }
                disabled={acting}
              />
              <button
                onClick={handleAction}
                disabled={acting || !input.trim() || (activeAction !== 'investigate' && !selectedTarget)}
                style={styles.sendBtn}
              >
                {acting ? '⏳' : '发送'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    waiting: '等待中', intro: '开场介绍', playing: '游戏进行中', voting: '投票阶段', ended: '已结束',
  };
  return map[phase] || phase;
}

function moodColor(mood: string): string {
  const map: Record<string, string> = {
    calm: '#2ecc71', nervous: '#f39c12', fear: '#e74c3c', anger: '#e74c3c',
    suspicion: '#9b59b6', trust: '#3498db',
  };
  return map[mood] || '#fff';
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', height: '100vh', background: '#0c0c1d' },
  loading: { color: '#fff', textAlign: 'center', paddingTop: '40vh', fontSize: 18 },

  // 侧边栏
  sidebar: {
    width: 300, minWidth: 300, background: 'rgba(255,255,255,0.03)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: '20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
  },
  sidePanel: {
    padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  panelTitle: {
    color: '#667eea', fontSize: 12, fontWeight: 700, margin: '0 0 10px',
    textTransform: 'uppercase' as const, letterSpacing: 1,
  },
  charName: { color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 },
  charInfo: { color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '4px 0 10px' },
  details: { marginTop: 6 },
  summary: { color: 'rgba(255,255,255,0.55)', fontSize: 12, cursor: 'pointer', padding: '2px 0' },
  detailText: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.6,
    margin: '4px 0 0 12px', maxHeight: 150, overflowY: 'auto' as const,
  },
  npcItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
    color: 'rgba(255,255,255,0.7)', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  npcOcc: { fontSize: 11, opacity: 0.5, marginLeft: 'auto' },
  npcMood: { fontSize: 11 },
  clueBtn: {
    width: '100%', padding: '10px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer',
    transition: 'all 0.2s',
  },
  clueList: { marginTop: 10 },
  noClue: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: 10 },
  clueItem: { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  clueDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 },
  infoText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0' },
  leaveBtn: {
    width: '100%', padding: '10px', borderRadius: 10, marginTop: 'auto',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer',
  },

  // 主区域
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const,
    background: 'rgba(255,255,255,0.02)',
  },
  gameTitle: { color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 },
  round: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
  headerBtns: { display: 'flex', gap: 8, marginLeft: 'auto' },
  roundBtn: {
    padding: '8px 18px', borderRadius: 10, border: '1px solid #667eea',
    background: 'transparent', color: '#667eea', fontSize: 13, cursor: 'pointer',
  },
  endBtn: {
    padding: '8px 18px', borderRadius: 10, border: 'none',
    background: '#e74c3c', color: '#fff', fontSize: 13, cursor: 'pointer',
  },

  // 聊天
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  messages: {
    flex: 1, overflowY: 'auto', padding: 20,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  emptyChat: {
    textAlign: 'center', color: 'rgba(255,255,255,0.3)',
    marginTop: '20vh', fontSize: 14,
  },
  msg: {
    padding: '10px 16px', borderRadius: 16,
    background: 'rgba(255,255,255,0.04)', maxWidth: '75%', alignSelf: 'flex-start',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  msgMine: {
    background: 'rgba(102,126,234,0.12)', alignSelf: 'flex-end',
    border: '1px solid rgba(102,126,234,0.2)',
  },
  msgGM: {
    background: 'rgba(46,204,113,0.08)', alignSelf: 'center', maxWidth: '90%',
    border: '1px solid rgba(46,204,113,0.15)', textAlign: 'center' as const,
  },
  msgClue: {
    background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.2)',
  },
  msgError: {
    background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.15)',
    alignSelf: 'center', maxWidth: '90%',
  },
  msgSpeaker: {
    color: '#667eea', fontSize: 11, fontWeight: 600,
    display: 'block', marginBottom: 4, textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  msgContent: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const,
  },

  // 输入区
  inputArea: { padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' },
  actions: { display: 'flex', gap: 8, marginBottom: 10 },
  actionBtn: {
    padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionBtnActive: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderColor: 'transparent', color: '#fff', fontWeight: 600,
  },
  targetRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  targetLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, whiteSpace: 'nowrap' as const },
  targetList: { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  targetBtn: {
    padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer',
    transition: 'all 0.2s',
  },
  targetBtnActive: {
    background: 'rgba(102,126,234,0.2)', borderColor: '#667eea', color: '#667eea',
  },
  inputRow: { display: 'flex', gap: 10 },
  chatInput: {
    flex: 1, padding: '12px 18px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#fff', fontSize: 14, outline: 'none',
  },
  sendBtn: {
    padding: '12px 28px', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    marginLeft: 8,
  },

  // 结束页
  endContainer: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 50%, #16213e 100%)', padding: 40,
  },
  endCard: {
    background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 24,
    padding: '48px 40px', maxWidth: 700, width: '100%',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  endTitle: { fontSize: 36, fontWeight: 800, color: '#fff', textAlign: 'center', margin: 0 },
  endScriptTitle: { fontSize: 18, color: '#667eea', textAlign: 'center', marginTop: 12 },
  endRecap: {
    marginTop: 24, padding: 24, borderRadius: 16,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' as const,
  },
  endBtn: {
    display: 'block', margin: '32px auto 0', padding: '14px 40px', borderRadius: 14,
    border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
};
