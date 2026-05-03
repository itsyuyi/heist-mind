# HeistMind 🕵️

AI 驱动的剧本杀游戏平台。让大模型为你生成沉浸式推理游戏，AI 扮演 NPC，你来破案！

## ✨ 特性

- **AI 剧本生成**：一键生成完整剧本包（角色背景 2000+ 字、线索、时间线、多结局）
- **智能 NPC**：每个 NPC 拥有独立人格、记忆和情绪系统，根据玩家行为动态调整策略
- **AI 主持人**：控制游戏节奏、分发线索、推动剧情发展
- **三种主题**：民国谍战 🇨🇳 · 赛博朋克 🤖 · 日式本格推理 🔍

## 🏗️ 技术架构

```
heist-mind/
├── backend/          # Fastify + TypeScript
│   └── src/
│       ├── agents/   # AI Agent: WorldBuilder / GameMaster / SoulEngine
│       ├── core/     # LLM 路由、配置管理
│       └── models/   # Zod 数据模型
└── frontend/         # React + Vite + TypeScript
    └── src/
        ├── pages/    # HomePage / LobbyPage / GamePage
        ├── services/ # API 客户端
        └── stores/   # 状态管理
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
# 后端
cd backend && npm install

# 前端
cd frontend && npm install
```

### 配置环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填入你的 API Key：

```env
MIMO_API_KEY=your_mimo_api_key
MIMO_API_BASE=https://api.xiaomimimo.com/v1
DEFAULT_MODEL_PROVIDER=mimo
DEFAULT_MODEL_NAME=mimo-v2.5-pro
```

支持 MiMo 和 OpenAI 两种 Provider，通过 `DEFAULT_MODEL_PROVIDER` 切换。

### 启动开发服务器

```bash
# 后端（端口 8000）
cd backend && npm run dev

# 前端（端口 5173，代理 API 到后端）
cd frontend && npm run dev
```

打开 http://localhost:5173 开始游戏！

## 🎮 游戏流程

1. **选择主题** → 民国谍战 / 赛博朋克 / 日式本格
2. **AI 生成剧本** → 等待大模型生成完整剧本包（约 30 秒）
3. **玩家加入** → 选择角色，阅读个人背景和秘密
4. **游戏进行** → 调查线索、与 NPC 对话、推理投票
5. **复盘时刻** → AI 主持人揭晓真相，生成复盘报告

## 📄 License

MIT
