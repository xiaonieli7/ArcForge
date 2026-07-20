# ADR-0007：多 Agent 演进门

状态：Proposed

## 背景

复杂工作未来需要委派和并行，但过早实现完整多 Agent API 会扩大状态、权限、成本和合并复杂度。

## 决策

首版只冻结以下不变量：

- Task 与 AgentRun 分离；
- Event 支持 `agent_id`、`parent_run_id`、`delegation_id` 和 `workspace_id`；
- 每个 Run 有独立配置、预算、权限、取消和资源 Lease；
- 子 Agent 权限只能继承或缩小；
- Runtime 使用版本化 capability 声明多 Agent 能力。

不提前实现未使用的 spawn/handoff/wait UI 和空接口。

## 演进顺序

1. 对同一不可变 Snapshot 并行只读调查；
2. 独立 Task Workspace 并行生成 Artifact；
3. Merge Coordinator 和冲突治理；
4. 最后评估产生外部 Effect 的多 Agent 编排。

## 后果

- 首版事件和数据模型不会锁死单 Agent。
- 多 Agent 不阻塞 Research & Report Core MVP。
- 并行写入必须等待 Workspace Lease、预算、取消树和合并语义完成。
