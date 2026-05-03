import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useGameStore } from '../stores/gameStore';
import type { GameState, Script, CharacterCard } from '../types';

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

  const handleJoin = async () => {
    if (!playerName || !selectedChar || !gameId) { setError('请填写姓名并选择角色'); return; }
    setJoining(true);
    setError('');
    try {
      const player = await api.joinGame(gameId, playerName, selectedChar);
      setCurrentGame(game);
      setCurrentPlayer(player);
      navigate(`/game/${gameId}`);
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
    return <div style={styles.loading}>加载中...</div>;
  }
  if (!game || !script) {
    return <div style={styles.loading}>{error || '房间不存在'}</div>;
  }

  const taken = Object.values(game.players).map((p) => p.character_id);

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
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🎭 选择角色</h3>
          <div style={styles.charGrid}>
            {script.characters.map((char: CharacterCard) => {
              const isTaken = taken.includes(char.id);
              return (
                <button
                  key={char.id}
                  onClick={() => !isTaken && setSelectedChar(char.id)}
                  disabled={isTaken}
                  style={{
                    ...styles.charBtn,
                    ...(selectedChar === char.id ? styles.charBtnSelected : {}),
                    ...(isTaken ? styles.charBtnTaken : {}),
                  }}
                >
                  <div style={styles.charName}>{char.name}</div>
                  <div style={styles.charOcc}>{char.occupation}</div>
                  {isTaken && <div style={styles.taken}>已选</div>}
                </button>
              );
            })}
          </div>

          <input
            style={styles.input}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="你的名字"
          />

          {selectedChar && (
            <div style={styles.preview}>
              {(() => {
                const c = script.characters.find((ch: CharacterCard) => ch.id === selectedChar);
                if (!c) return null;
                return (
                  <>
                    <p style={styles.previewTitle}>{c.name} · {c.gender} · {c.age}岁 · {c.occupation}</p>
                    <p style={styles.previewText}>性格：{c.personality}</p>
                  </>
                );
              })()}
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
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
            <button onClick={handleStart} style={styles.startBtn}>
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
    padding: '40px', maxWidth: 700, width: '100%',
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  loading: { color: '#fff', textAlign: 'center', paddingTop: '40vh', fontSize: 18 },
  title: { fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, textAlign: 'center' },
  scriptTitle: { fontSize: 20, color: '#667eea', textAlign: 'center', marginTop: 12 },
  summary: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 },
  shareSection: { textAlign: 'center', marginTop: 16 },
  shareBtn: {
    padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14,
  },
  section: { marginTop: 24 },
  sectionTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 12 },
  charGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 },
  charBtn: {
    padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
    fontSize: 13, textAlign: 'center' as const, transition: 'all 0.2s',
  },
  charBtnSelected: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)', borderColor: 'transparent', color: '#fff',
  },
  charBtnTaken: { opacity: 0.35, cursor: 'not-allowed' },
  charName: { fontWeight: 600, fontSize: 15 },
  charOcc: { fontSize: 12, color: 'inherit', marginTop: 2, opacity: 0.7 },
  taken: { fontSize: 11, color: '#ff6b6b', marginTop: 4 },
  input: {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
    color: '#fff', fontSize: 14, outline: 'none', marginTop: 12, boxSizing: 'border-box' as const,
  },
  preview: {
    marginTop: 12, padding: '12px 16px', borderRadius: 12,
    background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.2)',
  },
  previewTitle: { color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 },
  previewText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, marginBottom: 0 },
  actions: { display: 'flex', gap: 12, marginTop: 16 },
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
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 12, textAlign: 'center' },
};
