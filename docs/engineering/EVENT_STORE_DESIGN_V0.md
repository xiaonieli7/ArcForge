# Event Store 与 Effect Ledger 设计 V0

状态：G0.5 design draft；不可执行 Schema

## 1. 设计目标

- SQLite append-only `events` 是领域事实唯一来源；
- ApplicationCommand 幂等、Aggregate optimistic concurrency 和 deterministic replay 可证明；
- Projection、Outbox 和 Authorization Ledger 可重建或对账，但不能覆盖 DomainEvent；
- Effect 授权、投递、Receipt、Unknown 和恢复不存在“默认成功”路径；
- 未知 Schema、损坏、磁盘满和迁移失败时 fail closed。

## 2. 概念表

### `events`

```text
global_position INTEGER PRIMARY KEY AUTOINCREMENT
event_id TEXT UNIQUE NOT NULL
aggregate_type TEXT NOT NULL
aggregate_id TEXT NOT NULL
aggregate_sequence INTEGER NOT NULL
event_type TEXT NOT NULL
schema_version INTEGER NOT NULL
occurred_at_trusted TEXT NOT NULL
command_id TEXT NOT NULL
correlation_id TEXT
payload_json_or_content_ref TEXT NOT NULL
payload_hash TEXT NOT NULL
UNIQUE(aggregate_id, aggregate_sequence)
```

正文和高敏感内容不内嵌，只保存 ContentRef、Hash、大小和分类。Event 不允许 UPDATE/DELETE；保留与删除使用新事件和外部内容清除证明。

### `commands`

```text
command_id TEXT PRIMARY KEY
payload_hash TEXT NOT NULL
status TEXT NOT NULL
receipt_json TEXT NOT NULL
accepted_global_position INTEGER
created_at_trusted TEXT NOT NULL
```

同 ID/同 Hash 返回原 Receipt；不同 Hash 返回永久 `IdempotencyConflict`。

### `authorization_ledger`

```text
authorization_id TEXT PRIMARY KEY
effect_id TEXT UNIQUE NOT NULL
invocation_spec_hash TEXT NOT NULL
policy_decision_id TEXT NOT NULL
approval_id TEXT
fencing_scope TEXT NOT NULL
fencing_token INTEGER NOT NULL
remaining_uses INTEGER NOT NULL
expires_at_trusted TEXT NOT NULL
state TEXT NOT NULL
UNIQUE(fencing_scope, fencing_token)
```

Ledger 是执行控制数据，不是 Effect 领域状态来源。其行必须能追溯 `effect.authorized` Event。

### `effect_outbox`

```text
outbox_id TEXT PRIMARY KEY
effect_id TEXT UNIQUE NOT NULL
authorization_id TEXT NOT NULL
invocation_spec_ref TEXT NOT NULL
invocation_spec_hash TEXT NOT NULL
state TEXT NOT NULL
claim_owner TEXT
claim_generation INTEGER NOT NULL
claim_expires_at_trusted TEXT
attempt_count INTEGER NOT NULL
last_error_code TEXT
```

Outbox 不允许对 Executing/Unknown 自动重发。只有可证明未开始且新 fencing claim 成功的记录可以重新派发。

### `projection_checkpoints`

```text
projection_name TEXT PRIMARY KEY
projection_schema_version INTEGER NOT NULL
last_global_position INTEGER NOT NULL
state_hash TEXT NOT NULL
complete INTEGER NOT NULL
```

Projection 可删除重建。未知 Event Schema 时 `complete=0`，Effect Gate 全局关闭。

### `snapshots`

只作为 replay 加速，绑定 aggregate sequence、projection/domain schema、state hash 和创建位置。Snapshot 损坏时回退全量 Event replay；不能作为事实源。

### `migration_history`

记录 from/to schema、migration ID/hash、started/completed、backup/rollback evidence。Migration 未完成时进入 NeedsUpgrade 或只读恢复。

## 3. 原子事务

### T1：普通命令接受

1. 插入或验证 `commands`；
2. 检查 expected aggregate sequence；
3. append DomainEvent；
4. 写 CommandReceipt；
5. commit。

任何失败整体 rollback。`Accepted` 只表示命令和 Event 已安全记录。

### T2：Approval 消费与 Effect 授权

同一事务必须完成：

1. 校验 Approval、Policy、资源版本、spec hash、expiry 和 uses；
2. append approval consumed / effect authorized Events；
3. 插入 Authorization Ledger 与新 fencing token；
4. 插入 Effect Outbox；
5. 写 CommandReceipt；
6. commit。

禁止出现可执行 Outbox 而没有已提交 authorized Event，也禁止 Event 已授权但缺少 Ledger/Outbox。

### T3：执行开始

Broker claim Outbox 后重新验证 Authorization 和 fencing，在同一事务 append `effect.execution_started` 并把 Outbox 标为 Executing。若外部调用发生前崩溃，可以依据 started Event 与 Provider/Journal 观察决定是否 Unknown；不能只凭 claim 推断。

### T4：Receipt 与对账

验证 Receipt 来源、effect/invocation/authorization/idempotency ID 和资源身份后，在同一事务：

- append Applied/Failed/PartiallyApplied/Unknown 或 reconciliation Event；
- 保存 Receipt ContentRef/hash 和逐资源结果；
- 终结或冻结 Outbox；
- 更新 Ledger 使用状态。

迟到 Receipt 不能直接覆盖 Event 历史；必须追加显式 reconciliation Event。

## 4. Replay 与确定性

- 事件按 `global_position` 和 aggregate sequence 排序；
- reducer 只依赖 Event 内容和固定 schema，不读取当前时间、文件或网络；
- 重放 100 次的规范投影 hash 必须一致；
- Backend/Provider 乱序事件先按 source sequence 去重，再由 Process Manager 生成 DomainCommand；
- 终态之后的迟到 Runtime Event 只能形成 ignored/late observation，不改写事实。

## 5. 故障行为

| 故障 | 必须行为 |
|---|---|
| Unknown Event Schema | Projection Incomplete；Effect Gate 关闭；要求升级/恢复 |
| SQLite integrity failure | 只读恢复；不执行 Outbox |
| Disk full/IO error | 当前事务 rollback；不得留下半授权 Effect |
| Lock contention | 有界等待并返回 Unavailable；UI 不伪装成功 |
| Crash before commit | 事务不可见；相同 Command 可安全重试 |
| Crash after commit before Receipt response | 相同 Command 返回已存 Receipt |
| Crash after external operation before Receipt | Effect Unknown；先对账；不自动重试 |
| Projection corruption | 从 Event 重建；重建完成前关闭 Effect Gate |
| Migration interrupted | NeedsUpgrade/只读恢复；禁止降级写入 |

## 6. G1 验证清单

- [ ] WAL 与同步级别在故障注入后不丢已确认事务；
- [ ] optimistic concurrency 冲突不会生成部分事件；
- [ ] T2 在每一个写点崩溃后均无分裂提交；
- [ ] Outbox duplicate delivery 不产生重复 Effect；
- [ ] Unknown 永不自动回到可派发状态；
- [ ] Snapshot 删除后 replay hash 不变；
- [ ] 未知 Schema、磁盘满、只读和损坏全部 fail closed；
- [ ] 诊断导出不包含 Secret 或高敏正文。

## 7. 未决项

SQLite synchronous/WAL 参数、ContentRef 加密与清除、Trusted Clock、fencing scope、Projection hash canonicalization 和数据库备份恢复策略留给 G1 Week 1 实测冻结。任何选择都不能改变 Domain Model 的状态语义。
