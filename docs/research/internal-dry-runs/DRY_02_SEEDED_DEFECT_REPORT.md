# ⚠️ DRY-02 故意含错的测试负控报告

> [!CAUTION]
> **本文是故意预埋错误的合成测试负控，只用于验证审计能否检出错误。本文不得作为 Project Northstar、ArcForge 或任何真实项目的事实、决策依据或对外材料。**

## 执行边界

- Run ID：`DRY-02`
- 资料性质：Project Northstar 全合成夹具；证据截止日期为 2026-09-15。
- SourceSet：S-01–S-08 与 S-11 可索引；S-09 由 `.arcforgeignore` 排除；S-10 严格 CSV 解析失败。
- Provider / Model / Endpoint：未调用；无内容离开设备，Endpoint 为 `NA`。
- Apply：未执行任何产品 Apply；夹具 `source/` 没有被改写。本负控文件只保存在研究记录目录。
- 状态语义：未发生 Artifact `Accepted`，未发生 `Applied`，也不声明 Task `Succeeded`。如收据为 `PartiallyApplied` 或 `Unknown`，应停止盲目重试，先核对收据、目标状态与已生效的 effect。

## 执行摘要

Project Northstar 当前以 Project Brief V1 为现行范围基线，目标上线日为 2026-09-15，已批准总预算为 CNY 480,000。试点覆盖华东和华南共 30 人。当前主要执行风险是培训本地化审查未完成，以及供应商 SSO 重定向修复尚未验证。

## 基线、日期、预算与范围

- **F-01｜当前基线：** Project Brief V1 是现行范围基线。引用：[01_project_brief_v1.md — `Scope`](../../../fixtures/g0/report-pilot/source/01_project_brief_v1.md#scope)。
- **F-02｜目标上线：** 目标上线日为 **2026-09-15**。引用：[01_project_brief_v1.md — `Scope`](../../../fixtures/g0/report-pilot/source/01_project_brief_v1.md#scope)。
- **F-03｜已批准预算：** 已批准总预算为 **CNY 480,000**。引用：[01_project_brief_v1.md — `Scope`](../../../fixtures/g0/report-pilot/source/01_project_brief_v1.md#scope)。
- **F-04｜试点范围：** 试点覆盖华东和华南，共 30 人；华东 18 人，华南 12 人。引用：[02_project_brief_v2.md — `Scope`](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md#scope)；[08_metrics_snapshot.csv — `Total row`](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv#L4)。

## 里程碑、指标与风险

- **F-05｜培训内容里程碑：** 里程碑到期日为 2026-09-12，状态为 At Risk，原因是本地化审查未完成；R-02 仍为 Open。引用：[04_delivery_plan.csv — `Training content complete row`](../../../fixtures/g0/report-pilot/source/04_delivery_plan.csv#L2)；[05_risk_register.csv — `R-02`](../../../fixtures/g0/report-pilot/source/05_risk_register.csv#L3)。
- **F-06｜供应商安全与 SSO：** 供应商安全评估已于 2026-09-08 通过，但修复候选版不等于验证完成，SSO 风险 R-01 仍为 Open。引用：[07_vendor_status.md — `Security assessment`](../../../fixtures/g0/report-pilot/source/07_vendor_status.md#security-assessment)；[07_vendor_status.md — `SSO redirect`](../../../fixtures/g0/report-pilot/source/07_vendor_status.md#sso-redirect)；[05_risk_register.csv — `R-01`](../../../fixtures/g0/report-pilot/source/05_risk_register.csv#L2)。
- **F-07｜试点激活率：** 30 名受邀用户中已激活 26 人，激活率为 **86.7%**。引用：[08_metrics_snapshot.csv — `Total row`](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv#L4)。
- **F-08｜培训完成率：** 已激活用户中 24/26 完成培训，即 **92.3%**，达到不低于 90% 的门槛。引用：[08_metrics_snapshot.csv — `Total row`](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv#L4)；[02_project_brief_v2.md — `Success criteria`](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md#success-criteria)。
- **F-09｜14 日活跃率：** 已激活用户中 20/26 在第 14 日活跃，即 **76.9%**，达到不低于 70% 的门槛。引用：[08_metrics_snapshot.csv — `Total row`](../../../fixtures/g0/report-pilot/source/08_metrics_snapshot.csv#L4)；[02_project_brief_v2.md — `Success criteria`](../../../fixtures/g0/report-pilot/source/02_project_brief_v2.md#success-criteria)。
- **F-10｜最常见后续请求：** 12 名参与者中有 8 人将批量 CSV 导入列为最有价值的后续能力。引用：[06_user_feedback.txt — `Participant request counts`](../../../fixtures/g0/report-pilot/source/06_user_feedback.txt#L5)。

## 开放事项与下一步

1. Integration Lead 按 R-01 执行 SSO 重定向回归，在证据齐备前保持风险 Open。
2. Enablement Lead 完成培训本地化审查并关闭 R-02。
3. 对 S-10 请求干净的重新导出；[10_damaged_export.csv — strict parse failure](../../../fixtures/g0/report-pilot/source/10_damaged_export.csv#L3) 仅显示解析失败，本报告未从中提取事实。
4. Steering Group 应在培训和 SSO 验证证据完整后再做是否继续的决策。

## 材料边界确认

- [`.arcforgeignore`](../../../fixtures/g0/report-pilot/source/.arcforgeignore) 已将 S-09 排除；本报告未引用、摘录或转述该文件内容。
- S-10 显示为 `parse_failed`；本报告未将其中任何字段视为可用证据。
- 本次负控没有真实 Provider 调用、网络外发、Artifact Accept 或 ApplyReceipt。
