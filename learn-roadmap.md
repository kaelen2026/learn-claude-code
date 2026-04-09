# Learn Claude Code - TypeScript 实现路径

## 项目概述

这是一个教学仓库，教你如何从零构建一个高完成度的 AI 编码代理系统（coding-agent harness）。

**核心目标**：理解决定 AI 代理效率的基础机制

## 学习路径（19 个阶段）

### 第一部分：单代理核心开发（s01-s06）

#### **s01 - Agent Loop（代理循环）**

- **概念**：AI 代理的基础运行循环
- **实现**：用户输入 → AI 处理 → 工具调用 → 返回结果 → 循环
- **TypeScript 要点**：
  - 异步循环控制
  - 消息队列管理
  - 状态机设计

#### **s02 - Tool Use（工具使用）**

- **概念**：让 AI 能调用外部工具（读文件、执行命令等）
- **实现**：工具注册、参数解析、结果返回
- **TypeScript 要点**：
  - 工具接口定义（interface/type）
  - 动态函数调用
  - 类型安全的参数验证

#### **s03 - Todo Write（任务管理）**

- **概念**：AI 自动生成和管理任务列表
- **实现**：任务创建、更新、完成状态追踪
- **TypeScript 要点**：
  - 任务数据结构（Task interface）
  - CRUD 操作
  - 状态管理

#### **s04 - Subagent（子代理）**

- **概念**：主代理可以创建子代理来处理子任务
- **实现**：代理层级、上下文传递、结果聚合
- **TypeScript 要点**：
  - 递归代理调用
  - Promise 并发控制
  - 父子通信协议

#### **s05 - Skill Loading（技能加载）**

- **概念**：动态加载专业技能模块
- **实现**：技能发现、加载、注册、调用
- **TypeScript 要点**：
  - 动态 import()
  - 插件系统设计
  - 技能元数据管理

#### **s06 - Context Compact（上下文压缩）**

- **概念**：优化长对话的上下文，避免超出 token 限制
- **实现**：消息摘要、历史压缩、重要信息保留
- **TypeScript 要点**：
  - 文本处理算法
  - Token 计数
  - 优先级队列

---

### 第二部分：安全、扩展性、记忆（s07-s11）

#### **s07 - Permission System（权限系统）**

- **概念**：控制 AI 可以执行哪些操作
- **实现**：权限检查、用户确认、危险操作拦截
- **TypeScript 要点**：
  - 权限枚举和位运算
  - 装饰器模式
  - 中间件设计

#### **s08 - Hook System（钩子系统）**

- **概念**：在关键时刻触发自定义逻辑
- **实现**：事件监听、钩子注册、生命周期管理
- **TypeScript 要点**：
  - 事件发射器（EventEmitter）
  - 回调函数类型
  - 异步钩子处理

#### **s09 - Memory System（记忆系统）**

- **概念**：跨会话保存和检索信息
- **实现**：记忆存储、检索、更新、分类
- **TypeScript 要点**：
  - 文件系统操作（fs/promises）
  - 向量数据库集成
  - 记忆索引和搜索

#### **s10 - System Prompt（系统提示词）**

- **概念**：构建和管理 AI 的系统指令
- **实现**：提示词模板、动态组装、上下文注入
- **TypeScript 要点**：
  - 模板字符串
  - 提示词构建器模式
  - 配置管理

#### **s11 - Error Recovery（错误恢复）**

- **概念**：处理失败并自动恢复
- **实现**：错误捕获、重试逻辑、回滚机制
- **TypeScript 要点**：
  - Try-catch 最佳实践
  - 重试策略（exponential backoff）
  - 错误类型系统

---

### 第三部分：持久化任务和调度（s12-s14）

#### **s12 - Task System（任务系统）**

- **概念**：完整的任务队列和执行系统
- **实现**：任务队列、优先级、依赖关系
- **TypeScript 要点**：
  - 队列数据结构
  - 任务调度算法
  - 依赖图（DAG）

#### **s13 - Background Tasks（后台任务）**

- **概念**：异步执行长时间运行的任务
- **实现**：后台进程、进度追踪、结果通知
- **TypeScript 要点**：
  - Worker threads
  - 进程间通信（IPC）
  - 异步状态管理

#### **s14 - Cron Scheduler（定时调度）**

- **概念**：按计划自动执行任务
- **实现**：Cron 表达式解析、定时触发
- **TypeScript 要点**：
  - node-cron 库使用
  - 时区处理
  - 持久化调度配置

---

### 第四部分：团队协作和集成（s15-s19）

#### **s15 - Agent Teams（代理团队）**

- **概念**：多个代理协同工作
- **实现**：角色分配、任务分发、结果合并
- **TypeScript 要点**：
  - 并发控制（Promise.all）
  - 代理协调器
  - 负载均衡

#### **s16 - Team Protocols（团队协议）**

- **概念**：代理间的通信标准
- **实现**：消息格式、协议定义、握手机制
- **TypeScript 要点**：
  - 协议接口定义
  - 消息序列化
  - 类型安全的通信

#### **s17 - Autonomous Agents（自主代理）**

- **概念**：代理可以自主决策和行动
- **实现**：目标设定、计划生成、自主执行
- **TypeScript 要点**：
  - 决策树算法
  - 状态机高级应用
  - 自主循环控制

#### **s18 - Worktree Task Isolation（任务隔离）**

- **概念**：在隔离环境中执行任务
- **实现**：Git worktree、沙箱环境、资源隔离
- **TypeScript 要点**：
  - 子进程管理（child_process）
  - 文件系统隔离
  - 环境变量管理

#### **s19 - MCP Plugin（模型上下文协议）**

- **概念**：集成外部能力和服务
- **实现**：MCP 协议实现、插件加载、能力路由
- **TypeScript 要点**：
  - 协议实现
  - 插件架构
  - 服务发现

---

## TypeScript 实现建议

### 技术栈推荐

```typescript
// 核心依赖
{
  "@anthropic-ai/sdk": "^0.x.x",      // Claude API
  "typescript": "^5.x.x",
  "tsx": "^4.x.x",                     // TypeScript 执行器

  // 工具库
  "zod": "^3.x.x",                     // 类型验证
  "node-cron": "^3.x.x",               // 定时任务
  "commander": "^12.x.x",              // CLI 工具

  // 可选
  "langchain": "^0.x.x",               // AI 工具链
  "chromadb": "^1.x.x"                 // 向量数据库
}
```

### 项目结构

```
learn-claude-code-ts/
├── src/
│   ├── stages/
│   │   ├── s01-agent-loop.ts
│   │   ├── s02-tool-use.ts
│   │   └── ...
│   ├── core/
│   │   ├── agent.ts
│   │   ├── tools.ts
│   │   └── types.ts
│   ├── utils/
│   └── index.ts
├── tests/
├── examples/
└── package.json
```

### 学习顺序建议

1. **第 1-2 周**：s01-s06（核心概念）
2. **第 3 周**：s07-s11（安全和记忆）
3. **第 4 周**：s12-s14（任务系统）
4. **第 5-6 周**：s15-s19（高级特性）

### 新手起步

从最简单的开始：

```typescript
// s01-agent-loop.ts - 最基础的代理循环
import Anthropic from '@anthropic-ai/sdk';

async function simpleAgentLoop() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const messages: Anthropic.MessageParam[] = [];

  // 用户输入
  const userMessage = "帮我创建一个 hello.txt 文件";
  messages.push({ role: 'user', content: userMessage });

  // AI 处理
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages,
  });

  console.log(response.content);
}

simpleAgentLoop();
```

## 学习资源

- **原仓库**：<https://github.com/shareAI-lab/learn-claude-code>
- **Claude API 文档**：<https://docs.anthropic.com/>
- **TypeScript 手册**：<https://www.typescriptlang.org/docs/>

## 下一步

1. Clone 原仓库查看 Python 实现
2. 阅读 `docs/` 目录的文档（有中文版）
3. 从 s01 开始，用 TypeScript 实现每个阶段
4. 每完成一个阶段，写测试验证功能
