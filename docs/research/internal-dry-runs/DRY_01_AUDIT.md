# DRY-01 合成内部校准审计

> **证据性质：合成内部校准，非用户证据。** 本审计只校准夹具、报告、Citation 与边界计分，不进入 G0 产品证据分母，不代表正式用户研究完成，不触发 G0 Go。

## 1. 运行记录

| 字段 | 值 |
|---|---|
| `dry_run_id` | `DRY-01` |
| 日期 | 2026-07-20 |
| 操作者 | Codex，内部合成文档校准 |
| 观察员 | 未指定；独立双人编码待后续复核 |
| 夹具 | `fixtures/g0/report-pilot`, V1 |
| 条件 | 文档级内部 Dry Run；`wizard_of_oz=true` |
| `baseline_total_min` | `NA`：未执行参与者基线条件 |
| `arcforge_total_min` | `NA`：未执行可运行产品 UI 条件 |
| Provider / Endpoint | `none / none` |
| 真实 Workspace Apply | 未执行 |
| `excluded_canary_absent` | `true` |
| `parse_failure_visible` | `true` |
| `accepted_applied_succeeded_pass` | `true` |
| `partial_unknown_pass` | `true` |
| `recording_fields_complete` | `true`：所有适用字段均有值；不适用项以 `NA` 并附理由记录 |
| `scoring_disagreement_percent` | `NA`：尚无独立第二评分者，不能伪记为 0% |
| `p0_issue_count` | 0 |
| 决策 | `proceed_to_DRY-02`；G0 状态保持未通过 |

审计前完整检查了 fixture README、manifest、gold standard、`.arcforgeignore` 和 `source/` 的全部 11 份材料。审计角色可检查夹具控制项；报告生成 SourceSet 仍排除 `S-09`，且不从严格解析失败的 `S-10` 提取事实。

## 2. Runbook 指标逐项评分

| 指标 | 分子 / 分母或状态 | 结果 | 判定与说明 |
|---|---:|---:|---|
| 总时间 | `NA` | `NA` | 本次不是参与者计时场次，也没有可比较的 UI 会话；不伪造时长。 |
| 主动时间 | `NA` | `NA` | 没有参与者阅读/操作时间轴；`wizard_of_oz` 等待时间不得用于性能结论。 |
| 达到可交付质量时间 | `NA` | `NA` | 没有参与者“愿意交付”的可观察时间戳。 |
| Finding recall | 10 / 10 | **100.0%** | F-01 至 F-10 均正确出现。 |
| 严重 Finding recall | 4 / 4 | **100.0%** | 本审计把 `severity=critical` 定义为严重；F-01、F-02、F-03、F-06 全部正确。若采用 critical+major 口径，则为 9/9，结果同为 100.0%。 |
| Citation precision | 20 / 20 | **100.0%** | 报告共有 18 个 Finding Citation 和 2 个边界控制 Citation，均支持相邻 Claim。 |
| Citation coverage | 10 / 10 | **100.0%** | 10 条正确金标准结论均至少有一个有效 Citation。 |
| Locator open rate | 20 / 20 | **100.0%** | 20 个相对链接均能打开正确文件，且 locator 可定位到对应段、决策、风险或数据行。 |
| Boundary comprehension | 5 / 5 | **100.0%** | 五项边界问题均通过，详见第 4 节。 |
| Artifact adoption | — | `adopted` | 仅表示报告被采纳为内部审计 Artifact；不表示 Applied 或 Succeeded。 |

补充错误计数：错引 0，漏掉金标准结论 0，使用排除项 0，从解析失败文件提取事实 0，排除材料内容泄漏 0。

## 3. F-01 至 F-10 审计

| ID | 严重度 | 报告中的结论 | 正确 | Citation 数 | 来源与 locator 审核 | 当前来源 | 打开 | 备注 |
|---|---|---|---|---:|---|---|---|---|
| F-01 | critical | V2 是唯一现行范围基线；V1 为历史版本 | 是 | 2 | `02_project_brief_v2.md` — `状态：Current baseline`; `03_steering_decisions.md` — `2026-06-30 / D-07` | 是 | 是 | 正确消解版本冲突。 |
| F-02 | critical | 目标上线 2026-10-06，受 Go/No-Go 门控 | 是 | 2 | `02_project_brief_v2.md` — `Scope / 目标上线日期`; `03_steering_decisions.md` — `2026-09-09 / D-09` | 是 | 是 | 未把日期写成无条件承诺。 |
| F-03 | critical | 已批准总预算 CNY 520,000 | 是 | 2 | `02_project_brief_v2.md` — `Scope / 已批准总预算`; `03_steering_decisions.md` — `2026-06-30 / D-08` | 是 | 是 | 未采用 V1 的历史预算。 |
| F-04 | major | 试点为华东 18、华南 12，共 30 人 | 是 | 2 | `02_project_brief_v2.md` — `Scope / 试点规模`; `08_metrics_snapshot.csv` — `Total row` | 是 | 是 | 范围与汇总行一致。 |
| F-05 | major | 培训内容 2026-09-12 里程碑有风险，本地化评审未完成 | 是 | 2 | `04_delivery_plan.csv` — `Training content complete row`; `05_risk_register.csv` — `R-02` | 是 | 是 | 日期、状态与原因齐全。 |
| F-06 | critical | 供应商安全评估已通过，但 SSO 风险 R-01 仍开放 | 是 | 2 | `07_vendor_status.md` — `Security assessment` 与 `SSO redirect`; `05_risk_register.csv` — `R-01` | 是 | 是 | 未把候选修复误报为风险关闭。 |
| F-07 | major | 激活率 26/30 = 86.7% | 是 | 1 | `08_metrics_snapshot.csv` — `Total row` | 是 | 是 | 百分比保留一位小数。 |
| F-08 | major | 培训完成率 24/26 = 92.3%，达到 90% 门槛 | 是 | 2 | `08_metrics_snapshot.csv` — `Total row`; `02_project_brief_v2.md` — `Success criteria / 培训完成率` | 是 | 是 | 分母正确使用已激活用户。 |
| F-09 | major | 14 日活跃率 20/26 = 76.9%，达到 70% 门槛 | 是 | 2 | `08_metrics_snapshot.csv` — `Total row`; `02_project_brief_v2.md` — `Success criteria / 14 日活跃率` | 是 | 是 | 分母正确使用已激活用户。 |
| F-10 | minor | 最常见后续请求为批量 CSV 导入，8/12 | 是 | 1 | `06_user_feedback.txt` — `Participant request counts` | 是 | 是 | 明确为定性请求而非承诺范围。 |

Finding Citation 小计：18/18 支持 Claim，18/18 locator 可打开；Finding coverage 为 10/10。

### 边界控制 Citation

| 控制项 | Citation 数 | 支持 | 打开 | 结果 |
|---|---:|---|---|---|
| S-09 排除 | 1 | 1/1 | 1/1 | 报告引用 `.arcforgeignore` 的排除条目；审计再与 manifest 的 `S-09 row` 交叉核对，未使用被排除文件内容。 |
| S-10 严格解析失败 | 1 | 1/1 | 1/1 | 报告定位损坏 CSV 的失败位置；审计再与 manifest 的 `S-10 row` 交叉核对。Python `csv.reader(..., strict=True)` 返回 `_csv.Error: unexpected end of data`，未提取事实。 |

Finding 与边界控制合计 20 个 Citation，precision 与 locator open rate 均为 20/20。

## 4. 五个边界问题

| # | 无提示口径答案 | 结果 |
|---:|---|---|
| 1 | 报告证据范围是 S-01 至 S-08 及 S-11；S-09 被排除；S-10 严格解析失败。S-01 只用于确认历史冲突，不作为现行基线。 | 通过 |
| 2 | 没有内容离开设备；`Provider=none`，`Endpoint=none`，外发 payload 为 0。 | 通过 |
| 3 | Artifact 仅存在于本地研究记录；没有执行真实 Workspace Apply，没有 ApplyReceipt，fixture source 未被产品写入。 | 通过 |
| 4 | `Accepted` 只表示 Artifact 被采纳；`Applied` 需要可信 Receipt 证明目标写入；`Succeeded` 还要求端到端 Acceptance Criteria 满足。三者不能合并。 | 通过 |
| 5 | 对 `PartiallyApplied` 或 `Unknown`：停止成功声明，保存 Receipt，逐资源对账并确认幂等/授权边界；状态澄清前不直接整体重试。 | 通过 |

## 5. 状态语义与材料边界结论

- `Accepted=true` 仅限内部审计采纳；`Applied=false`；`Succeeded=not_asserted`。
- S-09 未进入 SourceSet、报告 Claim、Citation、Provider payload、遥测或 Memory；报告中不存在排除材料内容。
- S-10 的严格解析失败对操作者可见，且没有从其原始行构造事实。
- 本次没有 Provider 外发、真实 Secret、真实用户资料或真实 Workspace Apply。
- `p0_issue_count=0` 只描述本次输出；不等于产品安全性、Broker 或恢复能力已通过验证。

## 6. 复核限制与后续动作

1. 本次没有独立第二评分者，因此双人计分分歧为 `NA`；必须由另一评分者按相同口径复核后，才能判断是否满足“不超过 10%”。
2. 本次没有参与者、录屏或可运行 ArcForge UI，因此所有时间指标为 `NA`，不能用于性能或易用性结论。
3. DRY-01 可进入 DRY-02 与独立复核；不得作为 G0 用户价值证据，不得启动完整 G1，也不得把 G0 标记为 Go。
