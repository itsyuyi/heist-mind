import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { ScriptTheme } from '../types';

export default function HomePage() {
  const navigate = useNavigate();
  const [themes, setThemes] = useState<ScriptTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [playerCount, setPlayerCount] = useState(6);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useState(() => {
    api.listThemes().then(setThemes).catch(console.error);
  });

  const handleGenerate = async () => {
    if (!selectedTheme) { setError('请选择剧本主题'); return; }
    setLoading(true);
    setError('');
    try {
      const script = await api.generateScript(selectedTheme, playerCount, title || undefined);
      const game = await api.createGame(script.id);
      navigate(`/lobby/${game.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔍 HeistMind</h1>
        <p style={styles.subtitle}>AI-Native 多人推理游戏引擎</p>
        <p style={styles.desc}>
          基于 MiMo V2.5 百万 Token 长上下文，AI 自动生成剧本、扮演 NPC、主持游戏。
          一人分享链接，好友即刻入局。
        </p>

        <div style={styles.form}>
          <label style={styles.label}>剧本主题</label>
          <div style={styles.themeGrid}>
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => setSelectedTheme(t.value)}
                style={{
                  ...styles.themeBtn,
                  ...(selectedTheme === t.value ? styles.themeBtnActive : {}),
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label style={styles.label}>玩家人数</label>
          <div style={styles.row}>
            {[4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                style={{
                  ...styles.countBtn,
                  ...(playerCount === n ? styles.countBtnActive : {}),
                }}
              >
                {n}人
              </button>
            ))}
          </div>

          <label style={styles.label}>剧本标题（可选）</label>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="留给 AI 自动起名..."
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              ...styles.generateBtn,
              ...(loading ? styles.generateBtnDisabled : {}),
            }}
          >
            {loading ? '⚡ AI 正在生成剧本...' : '🎭 生成剧本 & 创建房间'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 50%, #16213e 100%)',
    padding: 20,
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(20px)',
    borderRadius: 24,
    padding: '48px 40px',
    maxWidth: 560,
    width: '100%',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  title: { fontSize: 36, fontWeight: 800, color: '#fff', margin: 0, textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8 },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 },
  form: { marginTop: 32 },
  label: { display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8, marginTop: 16 },
  themeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  themeBtn: {
    padding: '12px 8px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all 0.2s',
  },
  themeBtnActive: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderColor: 'transparent',
    color: '#fff',
  },
  row: { display: 'flex', gap: 8 },
  countBtn: { ...({
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: 14,
    transition: 'all 0.2s',
  } as React.CSSProperties) },
  countBtnActive: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderColor: 'transparent',
    color: '#fff',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  generateBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    fontSize: 18,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 24,
    transition: 'all 0.2s',
  },
  generateBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 12, textAlign: 'center' },
};
