# HeistMind 功能检查清单

## 🟢 已完成

### 后端核心
- [x] LLM 双 Provider 路由（MiMo + OpenAI）
- [x] Fastify HTTP 服务
- [x] Zod 数据验证
- [x] 环境变量配置管理
- [x] .env 安全性（.gitignore）

### Agent 系统
- [x] WorldBuilder：AI 生成完整剧本包（角色/线索/时间线/结局）
- [x] GameMaster：AI 剧情推进描述
- [x] GameMaster：智能线索匹配（根据玩家描述）
- [x] GameMaster：完整投票系统（计票/揭晓/裁决）
- [x] GameMaster：复盘报告生成
- [x] SoulEngine：NPC 角色扮演
- [x] SoulEngine：NPC 记忆系统
- [x] SoulEngine：情绪/策略动态切换
- [x] SoulEngine：NPC 轮次间自主发言
- [x] SoulEngine：蝴蝶效应（跨 NPC 反应）

### API 路由
- [x] GET /themes - 主题列表
- [x] POST /scripts/generate - 生成剧本
- [x] GET /scripts - 剧本列表
- [x] GET /scripts/:id - 剧本详情
- [x] POST /games - 创建游戏
- [x] POST /games/:id/join - 加入游戏
- [x] GET /games/:id - 游戏状态
- [x] GET /games/:id/votes - 投票状态
- [x] POST /games/:id/start - 开始游戏
- [x] POST /games/:id/action - 玩家行动
- [x] POST /games/:id/next-round - 下一轮
- [x] POST /games/:id/end - 结束游戏

### 前端页面
- [x] HomePage：主题选择、人数设置、AI 生成剧本
- [x] LobbyPage：角色选择、邀请链接、房主开始
- [x] LobbyPage：自动检测游戏开始并跳转
- [x] GamePage：消息展示（GM/玩家/NPC/线索/错误）
- [x] GamePage：目标选择 UI（对话/NPC、投票对象）
- [x] GamePage：投票进度和揭晓展示
- [x] GamePage：线索手册折叠面板
- [x] GamePage：角色信息面板（背景/秘密/目标）
- [x] GamePage：NPC 状态展示（情绪着色）
- [x] GamePage：游戏结束复盘页
- [x] 深色赛博朋克 UI 风格

### 基础设施
- [x] TypeScript 全栈类型安全
- [x] Vite 代理配置（前端 → 后端）
- [x] 前端轮询机制（3s 间隔）
- [x] .gitignore
- [x] README.md

---

## 🟡 待定/可优化（非阻塞）

### 后端
- [ ] WebSocket 实时通信（当前轮询方案可工作）
- [ ] 持久化存储（当前内存存储，重启丢失）
- [ ] 用户认证系统
- [ ] 速率限制

### 前端
- [ ] 加载进度指示（剧本生成约 30s，无流式进度）
- [ ] 移动端适配
- [ ] 音效/BGM
- [ ] 角色立绘展示

### 剧本系统
- [ ] 预设经典剧本（不用每次都 AI 生成）
- [ ] 更多主题风格
- [ ] 难度选择
