# Learn Claude Code - TypeScript 实现

这是 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的 TypeScript 实现版本，帮助你从零开始构建一个 AI 编码代理系统。

## 迁移状态

仓库目前处于“两套结构并存”的迁移阶段：

- `src/legacy-stages/` 继续保留 19 个教学阶段示例
- `src/sdk/`、`src/cli/`、`src/index.ts` 是新的统一 runtime 骨架
- 新 runtime 已经正式接入 `memory` 和 `task` 的 store / manager / tool 三层
- 新 runtime 已经正式接入 `background`、`schedule` 的 store / manager / tool 三层
- 新 runtime 已经把 `permissions` 和 `hooks` 接入统一工具执行链
- 新 runtime 已经正式接入 `subagents/teams`、`worktrees` 和模拟 `MCP` 工具池
- 新 runtime 已经补入 `context compact`、`error recovery` 和 `autonomous` 控制模块
- `data/` 是新 runtime 的正式本地数据目录（已默认忽略提交）

如果你想体验新的统一入口，可以运行：

```bash
npm start -- help
npm start -- chat "帮我解释这个项目"
npm start -- task list
npm start -- memory list
npm start -- schedule list
npm start -- team list
npm start -- worktree list
npm start -- mcp list
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制 `.env.example` 为 `.env` 并填入你的 Anthropic API Key：

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key
```

获取 API Key：<https://console.anthropic.com/>

### 3. 运行示例

```bash
# 运行统一 runtime CLI
npm start -- help

# 使用统一 runtime 发起一次对话
npm start -- chat "帮我概览仓库结构"

# 运行 Stage 01: Agent Loop
npm run s01

# 运行 Stage 02: Tool Use
npm run s02

# 运行 Stage 03: Todo Write
npm run s03

# 运行 Stage 04: Subagent
npm run s04

# 运行 Stage 05: Skill Loading
npm run s05

# 运行 Stage 06: Context Compact
npm run s06
```

## 学习路径

详细的学习路径请查看 [learn-roadmap.md](./learn-roadmap.md)

### 19 个学习阶段

**第一部分：单代理核心开发（s01-s06）**

- ✅ s01: Agent Loop - 基础代理循环
- ✅ s02: Tool Use - 工具使用
- ✅ s03: Todo Write - 任务管理
- ✅ s04: Subagent - 子代理
- ✅ s05: Skill Loading - 技能加载
- ✅ s06: Context Compact - 上下文压缩

**第二部分：安全、扩展性、记忆（s07-s11）**

- ✅ s07: Permission System - 权限系统
- ✅ s08: Hook System - 钩子系统
- ✅ s09: Memory System - 记忆系统
- ✅ s10: System Prompt - 系统提示词
- ✅ s11: Error Recovery - 错误恢复

**第三部分：持久化任务和调度（s12-s14）**

- ✅ s12: Task System - 任务系统
- ✅ s13: Background Tasks - 后台任务
- ✅ s14: Scheduled Tasks - 定时调度

**第四部分：团队协作和集成（s15-s19）**

- ✅ s15: Agent Teams - 多代理团队
- ✅ s16: Team Protocols - 团队协议
- ✅ s17: Autonomous Agents - 自主代理
- ✅ s18: Worktree Isolation - 工作树隔离
- ✅ s19: MCP Plugin - MCP 插件系统

## 项目结构

```
learn-claude-code-ts/
├── src/
│   ├── cli/             # 新的 CLI 入口
│   ├── sdk/             # 新的统一 runtime / tools / stores 骨架
│   ├── legacy-stages/   # 各个学习阶段的历史实现
│   │   ├── s01-agent-loop.ts
│   │   ├── s02-tool-use.ts
│   │   ├── s03-todo-write.ts
│   │   ├── s04-subagent.ts
│   │   ├── s05-skill-loading.ts
│   │   ├── s06-context-compact.ts
│   │   ├── s07-permission-system.ts
│   │   ├── s08-hook-system.ts
│   │   ├── s09-memory-system.ts
│   │   ├── s10-system-prompt.ts
│   │   ├── s11-error-recovery.ts
│   │   ├── s12-task-system.ts
│   │   ├── s13-background-tasks.ts
│   │   ├── s14-scheduled-tasks.ts
│   │   ├── s15-agent-teams.ts
│   │   ├── s16-team-protocols.ts
│   │   ├── s17-autonomous-agents.ts
│   │   ├── s18-worktree-isolation.ts
│   │   ├── s19-mcp-plugin.ts
│   │   └── ...
│   ├── core/            # 旧版核心类型和工具（供 stages 使用）
│   │   ├── types.ts
│   │   ├── config.ts
│   │   └── client.ts
│   ├── examples/        # 基于新 runtime 的示例
│   └── index.ts         # 新统一 CLI 入口
├── data/                # 新 runtime 的本地运行数据
├── learn-roadmap.md     # 详细学习指南
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- **TypeScript 5.x** - 类型安全的 JavaScript
- **@anthropic-ai/sdk** - Claude API 官方 SDK
- **tsx** - TypeScript 执行器
- **zod** - 运行时类型验证

## 学习建议

1. **按顺序学习**：从 s01 开始，逐步深入
2. **动手实践**：每个阶段都运行代码，观察输出
3. **修改实验**：尝试修改参数和逻辑，看看会发生什么
4. **阅读注释**：代码中有详细的中文注释
5. **参考原仓库**：对比 Python 实现，理解核心概念

## 新旧对照

如果你想从旧 stage 过渡到新 runtime，可以看这份对照文档：

- [Stage 到 Runtime 映射](./docs/architecture/stage-mapping.md)

## 相关资源

- **原仓库**：<https://github.com/shareAI-lab/learn-claude-code>
- **Claude API 文档**：<https://docs.anthropic.com/>
- **TypeScript 手册**：<https://www.typescriptlang.org/docs/>

## 贡献

欢迎提交 Issue 和 Pull Request！

## License

MIT
