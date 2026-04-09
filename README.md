# Learn Claude Code - TypeScript 实现

从零构建一个类似 Claude Code 的 AI 编码代理系统。基于 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的 TypeScript 实现版本。

## 快速开始

```bash
npm install
cp .env.example .env   # 填入 Anthropic API Key
```

获取 API Key: https://console.anthropic.com/

### 交互式聊天

```bash
npm start -- chat
```

进入交互式终端，支持流式输出、spinner、彩色工具调用可视化。

| 命令 | 功能 |
|------|------|
| `/agent <task>` | 生成独立子代理处理任务 |
| `/help` | 显示帮助 |
| `/clear` | 清空对话 |
| `/exit` | 退出 |
| `ESC` | 中止当前任务 |

### 单次调用

```bash
npm start -- chat "帮我概览仓库结构"
npm start -- task list
npm start -- memory list
npm start -- schedule list
npm start -- team list
npm start -- worktree list
npm start -- mcp list
```

### 教学阶段

```bash
npm run s01   # Agent Loop
npm run s02   # Tool Use
# ... 通过 s19
```

## 19 个学习阶段

**第一部分：单代理核心（s01-s06）**

- s01: Agent Loop - 基础代理循环
- s02: Tool Use - 工具使用
- s03: Todo Write - 任务管理
- s04: Subagent - 子代理（真实 API 调用）
- s05: Skill Loading - 技能加载
- s06: Context Compact - 上下文压缩

**第二部分：安全、扩展、记忆（s07-s11）**

- s07: Permission System - 权限系统（交互式审批）
- s08: Hook System - 钩子系统
- s09: Memory System - 记忆系统
- s10: System Prompt - 系统提示词
- s11: Error Recovery - 错误恢复

**第三部分：持久化任务和调度（s12-s14）**

- s12: Task System - 任务系统
- s13: Background Tasks - 后台任务（真实 shell 执行）
- s14: Scheduled Tasks - 定时调度

**第四部分：团队协作和集成（s15-s19）**

- s15: Agent Teams - 多代理团队
- s16: Team Protocols - 团队协议
- s17: Autonomous Agents - 自主代理
- s18: Worktree Isolation - 工作树隔离
- s19: MCP Plugin - MCP 插件系统

详细学习路径: [learn-roadmap.md](./learn-roadmap.md)

## 项目结构

```
src/
├── cli/              # CLI 入口 + 交互式 UI
│   ├── commands/     # chat, task, memory, schedule, team, worktree, mcp
│   └── ui/           # renderer, spinner, theme, input, approval
├── sdk/              # 统一 runtime
│   ├── runtime/      # Agent Loop, System Prompt, Context Compact, Error Recovery
│   ├── tools/        # Tool Registry, Router, Executor + native/MCP 工具
│   ├── capabilities/ # 权限, 钩子, 记忆, 任务, 调度, 子代理, worktree
│   ├── stores/       # JSON 文件持久化层
│   ├── client/       # Anthropic SDK 封装 (含流式)
│   └── errors/       # 错误恢复策略
├── legacy-stages/    # 19 个教学阶段示例
├── core/             # 旧版类型/配置
└── index.ts          # CLI 入口
```

## 开发

```bash
npm run typecheck     # TypeScript 类型检查
npm run test          # 运行测试 (vitest)
npm run test:watch    # 测试 watch 模式
npm run lint          # Biome lint
npm run lint:fix      # Biome 自动修复
npm run format        # Biome 格式化
```

### 工具链

- **Biome** - lint + format
- **Husky** - Git hooks
- **lint-staged** - 提交前自动检查暂存文件
- **commitlint** - 强制 [Conventional Commits](https://www.conventionalcommits.org/) 格式
- **Vitest** - 单元测试 (125+ tests)
- **GitHub Actions** - CI (typecheck + lint + test)

## 技术栈

- **TypeScript 5.x** + Node.js (ESM)
- **@anthropic-ai/sdk** - Claude API (含流式)
- **chalk** + **ora** - 终端 UI
- **zod** - 运行时类型验证
- **vitest** - 测试框架

## 相关资源

- **原仓库**: https://github.com/shareAI-lab/learn-claude-code
- **Claude API 文档**: https://docs.anthropic.com/
- **Stage 到 Runtime 映射**: [docs/architecture/stage-mapping.md](./docs/architecture/stage-mapping.md)

## License

MIT
