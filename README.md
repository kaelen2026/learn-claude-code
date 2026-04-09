# Learn Claude Code - TypeScript 实现

这是 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的 TypeScript 实现版本，帮助你从零开始构建一个 AI 编码代理系统。

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

- ⏳ s15-s19: 待实现

## 项目结构

```
learn-claude-code-ts/
├── src/
│   ├── stages/          # 各个学习阶段的实现
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
│   │   └── ...
│   ├── core/            # 核心类型和工具
│   │   ├── types.ts
│   │   ├── config.ts
│   │   └── client.ts
│   └── index.ts
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

## 相关资源

- **原仓库**：<https://github.com/shareAI-lab/learn-claude-code>
- **Claude API 文档**：<https://docs.anthropic.com/>
- **TypeScript 手册**：<https://www.typescriptlang.org/docs/>

## 贡献

欢迎提交 Issue 和 Pull Request！

## License

MIT
