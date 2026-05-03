import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useGameStore } from '../stores/gameStore';
import type { GameState, Script, CharacterCard, PlayerState } from '../types';

export default function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { setCurrentGame, setCurrentPlayer } = useGameStore();

  const [game, setGame] = useState<GameState | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [selectedChar, setSelectedChar] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const g = await api.getGame(gameId);
        setGame(g);
        const s = await api.getScript(g.script_id);
        setScript(s);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [gameId]);

  // 轮询：检测游戏是否已开始（phase 变成 playing）
  useEffect(() => {
    if (!gameId || !myPlayerId) return;
    const interval = setInterval(async () => {
      try {
        const g = await api.getGame(gameId);
        setGame(g);
        if (g.phase === 'intro' || g.phase === 'playing') {
          setCurrentGame(g);
          navigate(`/game/${gameId}`);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [gameId, myPlayerId, navigate, setCurrentGame]);

  const handleJoin = async () => {
    if (!playerName || !selectedChar || !gameId) {
      setError('请填写姓名并选择角色');
      return;
    }
    setJoining(true);
    setError('');
    try {
      const player: PlayerState = await api.joinGame(gameId, playerName, selectedChar);
      setMyPlayerId(player.id);
      setCurrentGame(game);
      setCurrentPlayer(player);

      // 更新 game 状态以反映玩家列表变化
      const updatedGame = await api.getGame(gameId);
      setGame(updatedGame);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加入失败');
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    if (!gameId) return;
    try {
      const g = await api.startGame(gameId);
      setGame(g);
      setCurrentGame(g);
      navigate(`/game/${gameId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '开始失败');
    }
  };

  const handleCopyLink = () => {
    const link = window.location.origin + `/lobby/${gameId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return <div style={styles.loading}>⏳ 加载中...</div>;
  }
  if (!game || !script) {
    return <div style={styles.loading}>{error || '❌ 房间不存在'}</div>;
  }

  const taken = Object.values(game.players).map((p) => p.character_id);
  const playerCount = Object.keys(game.players).length;
  const canStart = playerCount >= 1;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🏠 游戏房间</h1>
        <h2 style={styles.scriptTitle}>{script.title}</h2>
        <p style={styles.summary}>{script.summary}</p>

        <div style={styles.shareSection}>
          <button onClick={handleCopyLink} style={styles.shareBtn}>
            {copied ? '✅ 已复制' : '📋 复制邀请链接'}
          </button>
          <span style={styles.playerCount}>
            👥 {playerCount}/{script.player_count} 人
          </span>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🎭 选择角色</h3>
          <div style={styles.charGrid}>
            {script.characters.map((char: CharacterCard) => {
              const isTaken = taken.includes(char.id);
              const takenByMe = myPlayerId && game.players[myPlayerId]?.character_id === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => !isTaken && setSelectedChar(char.id)}
                  disabled={isTaken && !takenByMe}
                  style={{
                    ...styles.charBtn,
                    ...(selectedChar === char.id || takenByMe ? styles.charBtnSelected : {}),
                    ...(isTaken && !takenByMe ? styles.charBtnTaken : {}),
                  }}
                >
                  <div style={styles.charName}>{char.name}</div>
                  <div style={styles.charOcc}>{char.occupation}</div>
                  {isTaken && !takenByMe && <div style={styles.taken}>已选</div>}
                  {takenByMe && <div style={styles.mine}>✅ 我的</div>}
                </button>
              );
            })}
          </div>

          {!myPlayerId && (
            <>
              <input
                style={styles.input}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="你的名字"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />

              {selectedChar && (
                <div style={styles.preview}>
                  {(() => {
                    const c = script.characters.find(
                      (ch: CharacterCard) => ch.id === selectedChar,
                    );
                    if (!c) return null;
                    return (
                      <>
                        <p style={styles.previewTitle}>
                          {c.name} · {c.gender} · {c.age}岁 · {c.occupation}
                        </p>
                        <p style={styles.previewText}>性格：{c.personality}</p>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
            {!myPlayerId ? (
              <button
                onClick={handleJoin}
                disabled={joining || !playerName || !selectedChar}
                style={{
                  ...styles.joinBtn,
                  ...(joining || !playerName || !selectedChar ? styles.btnDisabled : {}),
                }}
              >
                {joining ? '加入中...' : '🎮 加入游戏'}
              </button>
            ) : (
              <div style={styles.joinedMsg}>✅ 已加入，等待房主开始游戏...</div>
            )}
            <button
              onClick={handleStart}
              disabled={!canStart}
              style={{
                ...styles.startBtn,
                ...(!canStart ? styles.btnDisabled : {}),
              }}
            >
              ▶️ 房主开始
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 50%, #16213e 100%)', padding: 20,
  },
  card: {
    background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 24,
    padding: '40px', maxWidth: 720, width: '100%',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  loading: { color: '#fff', textAlign: 'center', paddingTop: '40vh', fontSize: 18 },
  title: { fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, textAlign: 'center' as const },
  scriptTitle: { fontSize: 20, color: '#667eea', textAlign: 'center' as const, marginTop: 12 },
  summary: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' as const,
    marginTop: 8, lineHeight: 1.5,
  },
  shareSection: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 16, marginTop: 20, marginBottom: 8,
  },
  shareBtn: {
    padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14,
  },
  playerCount: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  section: { marginTop: 24 },
  sectionTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: 600, marginBottom: 14 },
  charGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 },
  charBtn: {
    padding: '14px 10px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
    fontSize: 13, textAlign: 'center' as const, transition: 'all 0.2s',
    position: 'relative' as const,
  },
  charBtnSelected: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderColor: 'transparent', color: '#fff', fontWeight: 600,
  },
  charBtnTaken: { opacity: 0.3, cursor: 'not-allowed' },
  charName: { fontWeight: 700, fontSize: 15 },
  charOcc: { fontSize: 12, color: 'inherit', marginTop: 4, opacity: 0.7 },
  taken: { fontSize: 11, color: '#ff6b6b', marginTop: 6 },
  mine: { fontSize: 11, color: '#2ecc71', marginTop: 6 },
  input: {
    width: '100%', padding: '14px 18px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
    color: '#fff', fontSize: 15, outline: 'none', marginTop: 16, boxSizing: 'border-box' as const,
  },
  preview: {
    marginTop: 14, padding: '14px 18px', borderRadius: 14,
    background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)',
  },
  previewTitle: { color: '#fff', fontSize: 15, fontWeight: 600, margin: 0 },
  previewText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 6, marginBottom: 0 },
  actions: { display: 'flex', gap: 12, marginTop: 20 },
  joinedMsg: {
    flex: 1, padding: '14px', borderRadius: 14,
    background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.2)',
    color: '#2ecc71', fontSize: 14, textAlign: 'center' as const,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  joinBtn: {
    flex: 1, padding: '14px', borderRadius: 14,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
  startBtn: {
    flex: 1, padding: '14px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
    color: 'rgba(255,255,255,0.7)', fontSize: 16, cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 14, textAlign: 'center' as const },
};
