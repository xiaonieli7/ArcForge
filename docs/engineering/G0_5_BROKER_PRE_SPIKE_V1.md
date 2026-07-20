# G0.5 Trusted Execution Broker 限界预研 V1

状态：Completed on 2026-07-20 — Ready for G1 contract review；不是 G1 Go

授权来源：[G0 加速决策](../product/G0_ACCELERATION_DECISION_2026-07-20.md)

## 1. 目标

在不接真实 Runtime、Workspace、Secret、Provider 或 Effect 的前提下，把 G1 Week 1 最可能导致返工的合同和恢复问题提前暴露。G0.5 只产出设计证据，不产出可发布能力。

## 2. 每日工作包

### Day 1：合同来源与信任边界

- 为 AgentBackend、ExecutionBroker、EventStore、WorkspaceBroker、ProviderEgress、SecretResolver 指定唯一规范来源；
- 核对 ToolIntent → InvocationSpec → PolicyDecision → Approval → Authorization → EffectReceipt 链；
- 列出 Canonical Hash、Resource Identity、Clock、Expiry 和 fencing 的未决项。

产出：[Broker 合同冻结清单 V0](BROKER_CONTRACT_FREEZE_CHECKLIST_V0.md)。

### Day 2：威胁到测试

- 把路径逃逸、Reparse Point、TOCTOU、Plan 越权、网络旁路、Secret 泄漏、重复 Apply、旧 fencing token、Crash 和 Unknown 映射为 G1 测试；
- 每条测试写明观察点、期望事件和 Stop 条件。

产出：[Threat-to-Test Matrix V0](THREAT_TO_TEST_MATRIX_V0.csv)。

### Day 3：Event Store 与事务边界

- 设计 append-only Event、Command Receipt、Authorization Ledger、Effect Outbox、Projection Checkpoint 和 Migration 元数据；
- 明确哪些写入必须在同一 SQLite 事务；
- 定义 replay、未知 Schema、WAL、锁竞争、磁盘满和只读恢复行为。

产出：[Event Store Design V0](EVENT_STORE_DESIGN_V0.md)。

### Day 4：Mock Backend Fixture

- 定义至少 20 个声明式 Fixture；
- 每个 Fixture 固定输入、规范事件序列、Effect 数量和终态；
- 包含重复、乱序、过期授权、错误 Workspace、Cancel 后继续、Crash/Reconnect 和虚假成功。

产出：[Mock Backend Fixture Catalog V0](MOCK_BACKEND_FIXTURE_CATALOG_V0.md)。

### Day 5：桌面评审

- 逐项核对 Domain、Protocol、Threat Model、ADR 和四份 G0.5 产出；
- P0 必须关闭或触发 Stop；P1 必须有 Owner 和进入 G1 前期限；
- 输出 `Ready for G1 contract review` 或 `Stop`，不得输出 G1 Go。

## 3. 允许的验证方式

- Markdown/CSV 静态评审；
- 合成 ID、Hash、事件和资源身份示例；
- 纸面事务时序与 deterministic replay 推演；
- 标准夹具内部 Dry Run。

不运行数据库、不启动 AgentBackend、不访问网络、不调用系统凭据库、不修改真实 Workspace。

## 4. 停止条件

- InvocationSpec 在授权后仍可变；
- UI、Backend 或 Provider 能直接写领域事实；
- Event append 与可执行 Outbox/Authorization 无法原子关联；
- Unknown 会被自动重试或默认成功；
- ResourceHandle 无法绑定规范化 Windows 资源身份；
- Secret 必须进入 Command、Event、Args、Env 或 Fixture 才能完成流程；
- 为满足设计而提前依赖 Grok Build 私有行为。

## 5. 完成定义

四份设计资产齐全、互相链接、无 P0 术语冲突，且 [G0 加速决策](../product/G0_ACCELERATION_DECISION_2026-07-20.md)中的六项退出门均有证据。完成后仍回到 G0 产品证据门；完整 G1 只能由独立 Go/Conditional Go 决定启动。

## 6. 执行结果

| 工作包 | 证据 | 结果 |
|---|---|---|
| Day 1 合同 | [冻结清单](BROKER_CONTRACT_FREEZE_CHECKLIST_V0.md)与[八项设计决策](BROKER_CONTRACT_DECISIONS_V0.md) | BC-01 至 BC-08 经独立复核完成 G0.5 设计闭合；Contract 未冻结 |
| Day 2 威胁测试 | [Threat-to-Test Matrix](THREAT_TO_TEST_MATRIX_V0.csv) | 38 条计划测试，包含 canonical hash、时钟、fencing、路径、Secret、Receipt 与恢复 |
| Day 3 Event Store | [Event Store Design](EVENT_STORE_DESIGN_V0.md) | Prepared/T2、单写、fencing counter、Outbox claim 和 Unknown 路径书面闭合 |
| Day 4 Mock Backend | [Fixture Catalog](MOCK_BACKEND_FIXTURE_CATALOG_V0.md) | 24 个合成 Fixture，Runner 留给 G1 |
| Day 5 评审 | Domain/Protocol/Threat Model 交叉评审 | 修正可信时钟、Prepared 等价、未知字段、重叠 scope 和 Conflict 聚合问题 |
| 内部校准 | [第二编码总结](../research/internal-dry-runs/SECONDARY_CODING_SUMMARY.md) | 正控 10/10；负控检出 3/3；编码分歧 0.0%；无 canary 泄漏 |

最终决定：`Ready for G1 contract review`。未运行数据库、Runtime、Provider、Secret、Workspace Apply、网络或进程；正式 G0 产品证据仍未完成。
