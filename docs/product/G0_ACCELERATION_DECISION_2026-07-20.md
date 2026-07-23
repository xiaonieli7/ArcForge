# G0 加速与限界技术预研决策

日期：2026-07-20

状态：Approved for local research and design work

## 决策

本轮跳过三人外部用户 Pilot，使用两次合成标准夹具内部 Dry Run 校准主持、计时、Citation 审计和理解度计分。同时允许启动一个 5 个工作日的 `G0.5` Mock-only 技术预研，提前消除 Trusted Execution Broker 合同、恢复和 Event Store 事务设计风险。

本决策不豁免正式用户证据门，不表示 G0 Go，也不授权完整 5 周 G1、生产代码或真实 Effect。

## 背景

首位候选人 `EXP-01` 的任务频率和材料规模匹配，但主要使用 Windows 10、无法提供已授权脱敏材料且不参加 Diary，因此只保留为探索性记录，不计入样本。继续等待三人 Pilot 会推迟所有技术风险验证；直接进入完整 G1 又会把未经验证的产品假设转化为平台投资。

## 允许范围

- 使用 `fixtures/g0/report-pilot` 完成两次内部 Dry Run；
- 审阅并收敛 AgentBackend、ExecutionBroker、EventStore、WorkspaceBroker、ProviderEgress 和 SecretResolver 的概念合同；
- 建立 Threat-to-Test 矩阵、Mock Backend Fixture 目录和 Event Store Schema/事务草案；
- 发现 Protocol、Domain、Threat Model 和 ADR 之间的 P0/P1 矛盾；
- 形成供 G1 Week 1 使用的评审材料。

## 禁止范围

- 不把内部 Dry Run、探索性访谈或竞品走查计入正式用户样本；
- 不把 G0 状态改为 Go，不把 ADR 从 Proposed 改为 Accepted；
- 不创建生产 Tauri UI、安装包、更新器或持久化用户 Home；
- 不接真实 LLM、真实 Provider、真实 Secret、真实 MCP/Skill 或 Grok Build；
- 不读取或写入真实用户 Workspace；
- 不启动 Shell、第三方进程、外部网络或任何业务 Effect；
- 不宣称 Broker、Sandbox、Apply 或恢复能力已经通过验证。

## G0.5 退出门

1. 两次内部 Dry Run 完成，记录字段完整，双人计分分歧不超过 10%，无 canary 泄漏；
2. 所有 Broker 合同字段有唯一规范来源，P0 未决项有 Owner 和停止条件；
3. 每个威胁至少映射一个可执行的 G1 负测试；
4. Event append、Approval 消费、Authorization/fencing 和 Outbox 入队的事务边界可以书面证明；
5. Unknown、Partial Apply、迟到 Receipt 和重复命令均有确定的持久化与对账路径；
6. 未引入真实 Effect 或未经授权的数据处理。

未达到退出门时，停止 G0.5，不扩大实现。达到退出门只表示材料可进入 G1 评审，仍需正式产品证据和 G0 决策。

### 退出记录，2026-07-20

| 退出项 | 证据 | 状态 |
|---|---|---|
| 两次 Dry Run 与重复计分 | [第二编码总结](../research/internal-dry-runs/SECONDARY_CODING_SUMMARY.md) | 满足：正控/负控完成，分歧 0.0%，无 canary 泄漏 |
| Broker 合同来源与 P0 | [冻结清单](../engineering/BROKER_CONTRACT_FREEZE_CHECKLIST_V0.md)与[设计决策](../engineering/BROKER_CONTRACT_DECISIONS_V0.md) | 满足：BC-01 至 BC-08 设计闭合，G1 验证保留 |
| Threat-to-Test | [38 条矩阵](../engineering/THREAT_TO_TEST_MATRIX_V0.csv) | 满足：每项安全主题有 planned test |
| 事务边界 | [Event Store Design](../engineering/EVENT_STORE_DESIGN_V0.md) | 满足：Prepared/T2、Ledger、fencing 与 Outbox 同事务 |
| 恢复路径 | Event Store Design / Broker Decisions | 满足：Unknown、Partial、Late Receipt、Duplicate 均 fail closed |
| 无真实 Effect | Git diff 与执行记录 | 满足：只新增文档、CSV 和合成报告 |

G0.5 结论：`Ready for G1 contract review`。这不是 G0 Go、G1 Go 或 Contract Frozen。

## 后续恢复用户证据

正式研究仍按 [G0 用户研究计划](../research/USER_RESEARCH_PLAN_V1.md)执行 12 份有效样本。若团队决定永久放弃正式研究，必须另立产品风险接受记录，并删除所有“已验证用户价值”表述。
