# ADR-0003：隔离 Task Workspace

状态：Proposed

## 背景

ArcForge 需要生成报告、文档、表格和代码变更。若 Agent 直接写入真实 Workspace，就无法同时兑现“先审查、后应用”、冲突检测、崩溃恢复和未来多 Agent 隔离。

## 决策

- 每个可写 Task 使用独立 `task_workspace_id`。
- Agent 在隔离 Workspace/Overlay 中生成 Artifact 和文件变更。
- 用户审查 ChangeSet 后，由 Broker Apply 到真实目标。
- Apply 前重新校验目标资源版本或 Hash。
- 外部 SaaS Effect 不使用文件 Overlay，必须经过 Preview、Approval、Idempotency 和 EffectReceipt。
- Task Workspace 只提供变更审查、冲突和恢复隔离，不构成 Windows 安全 Sandbox。

## 后果

- 文件型任务可以明确区分 Generated、Reviewed 和 Applied。
- 需要 ChangeSet、三方冲突、Apply Journal 和启动恢复。
- Task Workspace 可丢弃，但不等同于完整 Checkpoint。
- 具有直接文件、网络、Shell 或子进程能力的第三方 Runtime 仍需要不可绕过的 Broker 或经验证的 OS 强制隔离。
