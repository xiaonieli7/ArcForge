# ADR-0002：Event Store 与单写者

状态：Proposed

## 背景

UI、Runtime、文件系统和外部系统可能分别产生状态。如果多个组件直接写同一 Task 历史，将产生乱序、重复和崩溃后无法对账的问题。

## 决策

- Application Core 内的 Storage Broker（`DomainStoreWriter`）是 ArcForge Event Store 的唯一写入者，与执行真实 Effect 的 Trusted Execution Broker 分离。
- `state/arcforge.sqlite` 的 append-only Event Table 是唯一领域事实源。
- Agent Backend 与 Capability Provider 只能提交外部事件或执行结果，由 Core 归一化后写入。
- Event、Effect Outbox 和关键授权状态在同一 SQLite 事务提交。
- JSONL 仅用于用户主动导出或诊断，不参与在线恢复。
- UI State、Memory Search Index 和其他查询模型是可重建投影。
- 每个 Aggregate Stream 使用单调 `aggregate_sequence`，数据库分配 `global_position`；事件带 Schema、Scope、Correlation 和 Causation。
- 原始 Runtime 日志不能直接作为用户状态。

## 后果

- 需要 Event Adapter、去重、乱序缓冲和恢复对账。
- 需要 WAL、完整性检查、一致快照和数据库迁移。
- Effect Outbox 与 Authorization Ledger 只用于投递、claim、fencing 和恢复，不是第二事实源；Unknown 不得依据 Outbox 自动重放。
- 删除敏感内容需要 Tombstone、可擦除 Blob 和受控 Compaction。
- 大 Thread 需要 Projection Snapshot；JSONL 分段只属于导出格式。
