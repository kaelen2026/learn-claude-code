# Stage 到 Runtime 映射

这份文档说明旧的教学阶段如何映射到新的统一 runtime 结构。

## 总体原则

- `src/legacy-stages/` 保留教学和历史参考价值
- `src/sdk/` 承担新的正式运行时能力
- `src/cli/` 承担用户入口
- `data/` 承担正式运行数据

## 逐阶段映射

### s01 Agent Loop

- 旧位置: `src/legacy-stages/s01-agent-loop.ts`
- 新位置:
  - `src/sdk/runtime/agent-runtime.ts`
  - `src/sdk/runtime/message-state.ts`
  - `src/sdk/client/model-gateway.ts`

### s02 Tool Use

- 旧位置: `src/legacy-stages/s02-tool-use.ts`
- 新位置:
  - `src/sdk/tools/tool-registry.ts`
  - `src/sdk/tools/tool-router.ts`
  - `src/sdk/tools/tool-executor.ts`

### s03 Todo Write

- 旧位置: `src/legacy-stages/s03-todo-write.ts`
- 新位置:
  - `src/sdk/capabilities/tasks/task-manager.ts`
  - `src/sdk/stores/tasks/task-store.ts`

### s04 Subagent

- 旧位置: `src/legacy-stages/s04-subagent.ts`
- 新位置:
  - `src/sdk/capabilities/subagents/subagent-manager.ts`
  - `src/sdk/tools/native/agent/spawn-subagent.ts`
  - `src/sdk/tools/native/agent/list-results.ts`

### s05 Skill Loading

- 旧位置: `src/legacy-stages/s05-skill-loading.ts`
- 新位置:
  - `src/sdk/capabilities/skills/skill-registry.ts`
  - `src/sdk/capabilities/skills/frontmatter.ts`
  - `src/sdk/runtime/context-assembler.ts`

### s06 Context Compact

- 旧位置: `src/legacy-stages/s06-context-compact.ts`
- 新位置:
  - `src/sdk/runtime/compact/context-compactor.ts`
  - `src/sdk/runtime/compact/context-estimator.ts`
  - `src/sdk/runtime/compact/compact-state.ts`
  - `src/sdk/runtime/agent-runtime.ts`

### s07 Permission System

- 旧位置: `src/legacy-stages/s07-permission-system.ts`
- 新位置:
  - `src/sdk/capabilities/permissions/permission-gate.ts`
  - `src/sdk/capabilities/permissions/policy-engine.ts`
  - `src/sdk/capabilities/permissions/risk-classifier.ts`

### s08 Hook System

- 旧位置: `src/legacy-stages/s08-hook-system.ts`
- 新位置:
  - `src/sdk/capabilities/hooks/hook-registry.ts`
  - `src/sdk/capabilities/hooks/hook-runner.ts`
  - `src/sdk/capabilities/hooks/lifecycle-events.ts`

### s09 Memory System

- 旧位置: `src/legacy-stages/s09-memory-system.ts`
- 新位置:
  - `src/sdk/capabilities/memory/memory-manager.ts`
  - `src/sdk/stores/memory/memory-store.ts`
  - `src/sdk/tools/native/memory/*`

### s10 System Prompt

- 旧位置: `src/legacy-stages/s10-system-prompt.ts`
- 新位置:
  - `src/sdk/runtime/system-prompt-builder.ts`
  - `src/sdk/runtime/context-assembler.ts`

### s11 Error Recovery

- 旧位置: `src/legacy-stages/s11-error-recovery.ts`
- 新位置:
  - `src/sdk/errors/recover.ts`
  - `src/sdk/errors/retry-policy.ts`
  - `src/sdk/errors/error-types.ts`
  - `src/sdk/runtime/agent-runtime.ts`

### s12 Task System

- 旧位置: `src/legacy-stages/s12-task-system.ts`
- 新位置:
  - `src/sdk/capabilities/tasks/*`
  - `src/sdk/stores/tasks/*`
  - `src/sdk/tools/native/task/*`

### s13 Background Tasks

- 旧位置: `src/legacy-stages/s13-background-tasks.ts`
- 新位置:
  - `src/sdk/capabilities/background/*`
  - `src/sdk/stores/background/*`
  - `src/sdk/runtime/notification-drain.ts`

### s14 Scheduled Tasks

- 旧位置: `src/legacy-stages/s14-scheduled-tasks.ts`
- 新位置:
  - `src/sdk/capabilities/scheduling/*`
  - `src/sdk/stores/schedules/*`
  - `src/sdk/tools/native/schedule/*`

### s15 Agent Teams

- 旧位置: `src/legacy-stages/s15-agent-teams.ts`
- 新位置:
  - `src/sdk/capabilities/subagents/team-manager.ts`
  - `src/sdk/capabilities/subagents/message-bus.ts`
  - `src/sdk/stores/teams/*`
  - `src/sdk/tools/native/agent/*`

### s16 Team Protocols

- 旧位置: `src/legacy-stages/s16-team-protocols.ts`
- 新位置:
  - `src/sdk/capabilities/subagents/protocol.ts`

### s17 Autonomous Agents

- 旧位置: `src/legacy-stages/s17-autonomous-agents.ts`
- 新位置:
  - `src/sdk/capabilities/autonomy/autonomous-controller.ts`
  - `src/sdk/capabilities/tasks/task-manager.ts`
  - `src/sdk/runtime/agent-runtime.ts`

### s18 Worktree Isolation

- 旧位置: `src/legacy-stages/s18-worktree-isolation.ts`
- 新位置:
  - `src/sdk/capabilities/worktrees/*`
  - `src/sdk/stores/worktrees/*`
  - `src/sdk/tools/native/worktree/*`

### s19 MCP Plugin

- 旧位置: `src/legacy-stages/s19-mcp-plugin.ts`
- 新位置:
  - `src/sdk/tools/mcp/mcp-client.ts`
  - `src/sdk/tools/mcp/mcp-registry.ts`
  - `src/sdk/tools/mcp/mcp-router.ts`

## 当前仍偏“简化实现”的能力

- `s06` 上下文压缩目前使用本地摘要策略，尚未恢复旧 demo 中的模型生成摘要能力
- `s11` 错误恢复已经独立模块化，但恢复路径仍然偏最小实现
- `s17` 自主代理目前以“任务建议与认领判断”为主，尚未扩展成完整多轮自治执行器
