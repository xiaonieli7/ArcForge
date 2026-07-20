# Project Northstar 状态报告 — DRY-01

> **证据性质：合成内部校准，非用户证据。** 本报告只使用 `fixtures/g0/report-pilot` 的合成资料校准报告与 Citation 审计流程，不进入 G0 用户样本分母，不表示 G0 已通过，也不证明 ArcForge 产品能力可用。

- 报告对象：Project Northstar Steering Group
- 证据截止：2026-09-15
- Dry Run：`DRY-01`
- 执行方式：文档级内部校准，`wizard_of_oz=true`

## 1. 执行摘要

Project Brief V2 是唯一现行范围基线，V1 仅作历史追溯。[S-02](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md)（locator：`状态：Current baseline`）与 [S-03](../../../fixtures/g0/report-pilot/source/03_steering_decisions.md)（locator：`2026-06-30 / D-07`）一致确认该版本决策。

目标上线日期为 2026-10-06，但上线以 2026-10-02 Go/No-Go 评审及成功标准满足为前提，不能视为无条件承诺。[S-02](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md)（locator：`Scope / 目标上线日期`）和 [S-03](../../../fixtures/g0/report-pilot/source/03_steering_decisions.md)（locator：`2026-09-09 / D-09`）。

已批准总预算为 CNY 520,000，不包含未批准的后续扩容。[S-02](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md)（locator：`Scope / 已批准总预算`）和 [S-03](../../../fixtures/g0/report-pilot/source/03_steering_decisions.md)（locator：`2026-06-30 / D-08`）。

试点范围为华东 18 人、华南 12 人，共 30 人。[S-02](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md)（locator：`Scope / 试点规模`）和 [S-08](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv)（locator：`Total row; invited=30`）。

综合判断为 **At Risk（推断）**：当前试点指标达到两项既定比例门槛，但培训内容里程碑处于风险状态，且供应商 SSO 风险尚未关闭。

## 2. 里程碑、风险与试点指标

### 2.1 里程碑与开放风险

- 培训内容完成里程碑原定 2026-09-12，状态为 `At Risk`，直接证据是本地化评审未完成。[S-04](../../../fixtures/g0/report-pilot/source/04_delivery_plan.csv)（locator：`Training content complete row`）和 [S-05](../../../fixtures/g0/report-pilot/source/05_risk_register.csv)（locator：`R-02`）。
- 供应商安全评估已于 2026-09-08 通过，但 SSO redirect 修复尚未完成回归验证，因此 `R-01` 仍为 `Open`。[S-07](../../../fixtures/g0/report-pilot/source/07_vendor_status.md)（locator：`Security assessment` 与 `SSO redirect`）和 [S-05](../../../fixtures/g0/report-pilot/source/05_risk_register.csv)（locator：`R-01`）。

### 2.2 试点指标

- 激活率为 26/30，即 **86.7%**。[S-08](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv)（locator：`Total row; activated=26, invited=30`）。
- 已激活用户中的培训完成率为 24/26，即 **92.3%**，达到不低于 90% 的门槛。[S-08](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv)（locator：`Total row; completed_training=24, activated=26`）和 [S-02](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md)（locator：`Success criteria / 培训完成率`）。
- 已激活用户中的 14 日活跃率为 20/26，即 **76.9%**，达到不低于 70% 的门槛。[S-08](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv)（locator：`Total row; day14_active=20, activated=26`）和 [S-02](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md)（locator：`Success criteria / 14 日活跃率`）。
- 最常见的后续能力请求是批量 CSV 导入，共 8/12 名参与者提出；这是定性请求，不是已承诺范围。[S-06](../../../fixtures/g0/report-pilot/source/06_user_feedback.txt)（locator：`Participant request counts / 8 participants requested bulk CSV import`）。

## 3. 建议下一步与 Steering Group 决策

1. 在 Go/No-Go 前完成 SSO redirect 回归验证；在结果确认前保持 `R-01 Open`，不得以候选构建替代关闭证据。
2. 完成本地化复核并重新确认培训内容里程碑；该事项当前不能按已完成报告。
3. 补齐尚未激活的 4 名试点用户，同时继续按“已激活用户”口径计算培训完成率与 14 日活跃率。
4. 对严格解析失败的数据请求干净重导出，失败文件继续隔离，不能从原始损坏行提取事实。
5. Steering Group 在 2026-10-02 按成功标准、开放风险和回归证据做 Go/No-Go 决策；本报告不提前给出 Go 结论。
6. Steering Group 可决定是否把批量 CSV 导入纳入后续发现阶段，但不得把定性请求自动转化为已批准范围或预算。

## 4. SourceSet 与执行边界

- 报告证据范围为 `S-01` 至 `S-08` 及 `S-11`；`S-01` 仅用于识别历史冲突，现行结论采用 `S-02`/`S-03`。
- `S-09` 由 Workspace 忽略规则排除；其内容没有进入报告事实、Citation、Provider payload、遥测或 Memory。[.arcforgeignore](../../../fixtures/g0/report-pilot/source/.arcforgeignore)（locator：`09_confidential_exclude.md entry`）。
- `S-10` 严格 CSV 解析返回失败，本报告没有从该文件提取事实。[S-10](../../../fixtures/g0/report-pilot/source/10_damaged_export.csv)（locator：`U-102 quoted field through end of file; strict parse failure`）。
- **Provider 外发：无。** `Provider=none`，`Endpoint=none`，外发内容为 0；全部证据只在本地仓库内检查。
- **真实 Workspace Apply：无。** 未调用 ArcForge WorkspaceBroker，未产生 ApplyReceipt，也未对真实用户 Workspace 执行写入。本文件只是内部校准记录，不构成产品 Apply。

## 5. Accepted / Applied / Succeeded 状态

| 状态 | 本次值 | 严格含义 |
|---|---|---|
| `Accepted` | `true`（仅内部校准） | 报告内容已被内部操作者采纳为可审计 Artifact；不代表任何目标文件已经写入。 |
| `Applied` | `false` | 没有可信 ApplyReceipt 证明目标资源已写入；真实 Workspace 未改变。 |
| `Succeeded` | `not_asserted` | 未执行真实产品任务与 Apply，因而不能宣称端到端任务成功。 |

若未来 ApplyReceipt 为 `PartiallyApplied` 或 `Unknown`，应停止全局成功声明，保留原始 Receipt，按目标资源逐项对账并确认幂等边界；在状态澄清前不得直接整体重试。
