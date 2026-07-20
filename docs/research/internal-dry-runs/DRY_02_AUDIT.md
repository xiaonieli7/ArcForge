# DRY-02 Seeded Defect Audit

## 审计结论

`DRY_02_SEEDED_DEFECT_REPORT.md` 是故意含三项预埋错误的负控。审计已检出 **3/3** 项预埋错误，无额外 F-04–F-10 事实错误。Artifact adoption 判定为 **`rejected`**；该负控不得作为项目事实或 G0 产品证据。

审计基准：

- `fixtures/g0/report-pilot/gold/GOLD_STANDARD.csv`
- `fixtures/g0/report-pilot/gold/FIXTURE_MANIFEST.csv`
- `docs/research/G0_PILOT_RUNBOOK_V1.md` 第 5 节

Finding Citation 审计范围是 F-01–F-10 下的 16 个引用实例。边界声明中的 `.arcforgeignore` 和 S-10 链接不是 Finding Citation，不进入 Citation precision 分母。

## 预埋错误检出

| defect_id | 对应 Finding | 负控中的错误 | 金标准 | 检出 | 处置 |
|---|---|---|---|---|---|
| SD-01 | F-01 | 将 V1 当作现行基线 | V2 是唯一现行基线，V1 仅供历史追溯 | Pass | 拒绝 Artifact；改用 V2 和 D-07 |
| SD-02 | F-02 | 将目标上线日写为 2026-09-15 | 目标为 2026-10-06，且以 Go/No-Go 和成功标准为条件 | Pass | 更正日期并保留条件语义 |
| SD-03 | F-03 | 将已批准总预算写为 CNY 480,000 | 已批准总预算是 CNY 520,000 | Pass | 改用 V2 和 D-08 |

**错误检出率：3/3 = 100.0%。**

## Finding 与 Citation 逐条审计

| Finding | severity | 负控结论是否符合金标准 | Citation support | Locator open | 审计说明 |
|---|---|---:|---:|---:|---|
| F-01 | critical | Fail | 0/1 | 1/1 | V1 文档自身明示已被 V2 替代，`Scope` 不支持“现行基线”。 |
| F-02 | critical | Fail | 0/1 | 1/1 | 历史 V1 的日期不支持当前目标日；权威日期为有条件的 2026-10-06。 |
| F-03 | critical | Fail | 0/1 | 1/1 | 历史 V1 的金额不支持当前已批准预算。 |
| F-04 | major | Pass | 2/2 | 2/2 | East 18 + South 12 = 30，两个来源一致。 |
| F-05 | major | Pass | 2/2 | 2/2 | 2026-09-12、At Risk、本地化未完成与 R-02 Open 均有支持。 |
| F-06 | critical | Pass | 3/3 | 3/3 | 安全评估通过与 SSO R-01 仍 Open 被正确区分。 |
| F-07 | major | Pass | 1/1 | 1/1 | 26/30 = 86.7%（保留一位小数）。 |
| F-08 | major | Pass | 2/2 | 2/2 | 24/26 = 92.3%，达到 90% 门槛。 |
| F-09 | major | Pass | 2/2 | 2/2 | 20/26 = 76.9%，达到 70% 门槛。 |
| F-10 | minor | Pass | 1/1 | 1/1 | 8/12 参与者请求批量 CSV 导入。 |
| **合计** | — | **7/10** | **13/16** | **16/16** | — |

Locator 检查口径：相对链接可解析到存在的文件，且链接锨点或相邻 locator 指向报告所声称的位置。F-01–F-03 的链接可打开历史 V1 的 `Scope`，因此 Locator open 通过；但整份文档的版本状态否定当前性，因此 Citation support 失败。

## 材料与执行边界审计

| 边界问题 | 审计结果 | 得分 | 证据 |
|---|---|---:|---|
| 哪些文件可用，哪个被排除，哪个解析失败？ | Pass | 1 | 报告正确记录 S-01–S-08/S-11 indexed、S-09 excluded、S-10 parse_failed。 |
| 哪些内容离开了设备，发往哪个 Provider/Endpoint？ | Pass | 1 | 无内容离开设备；无 Provider 调用，Endpoint=`NA`。 |
| Apply 前草稿在哪里，真实 Workspace 是否改变？ | Pass | 1 | 负控只在研究记录目录；未执行产品 Apply，fixture `source/` 未改变。 |
| Accepted、Applied、Succeeded 是否被合并？ | Pass | 1 | 三种状态均被分开声明且均未发生；审计 `rejected` 不等于产品状态。 |
| 如收据为 PartiallyApplied/Unknown 如何处理？ | Pass | 1 | 报告要求停止盲目重试，先核对收据、目标状态和已生效 effect。 |

**Boundary comprehension：5/5 = 100.0%。** 这是负控 Artifact 的书面边界检查，不是真实参与者理解度证据。

S-09 审计结果：排除文件的 canary 字面值未出现在负控报告或本审计中，无 P0 材料边界失败。

S-10 审计结果：正确显示为 `parse_failed`，未从中提取任何 Finding。

Provider/Apply 审计结果：本次是本地静态夹具审计，没有真实 Provider、Model、Endpoint、Artifact Accept、Apply 或 ApplyReceipt。

## Runbook 指标评分

| 指标 | 计算 | DRY-02 结果 | 判定/备注 |
|---|---|---:|---|
| 总时间 | 结束时间 - 开始时间 | `4m 19s` | 计分阶段从 2026-07-20 11:03:18 +08:00 至 2026-07-20 11:07:37 +08:00；前置夹具阅读不计入。 |
| 主动时间 | 阅读、编辑、核验时间 | `4m 19s` | 无产品等待或 Wizard-of-Oz 等待。 |
| 达到可交付质量时间 | 开始到愿意交付且通过最低结构检查 | `NA` | 负控故意保留 critical 错误，从未达到可交付质量。 |
| Finding recall | 正确金标准结论 / 10 | **7/10 = 70.0%** | F-01–F-03 错；F-04–F-10 正确。 |
| 严重 Finding recall | 正确 critical / 4 | **1/4 = 25.0%** | critical 为 F-01、F-02、F-03、F-06；仅 F-06 正确。 |
| Citation precision | 支持 Claim 的 Citation / 已审计 Citation | **13/16 = 81.3%** | F-01–F-03 的历史来源不支持当前性；其余 13 个支持。 |
| Citation coverage | 有有效 Citation 的正确 Finding / 正确 Finding | **7/7 = 100.0%** | 七个正确 Finding 均有至少一个有效 Citation。 |
| Locator open rate | 可打开到声称文件与 locator 的 Citation / 已测试 Citation | **16/16 = 100.0%** | 所有 Finding 相对链接可解析，locator 存在；可打开不代表引用支持当前 Claim。 |
| Boundary comprehension | 五个边界问题通过数 / 5 | **5/5 = 100.0%** | 书面负控检查，不进入 G0 用户证据。 |
| Artifact adoption | 分类 | **`rejected`** | 三个 critical 事实错误，不允许交付或 Apply。 |

## Dry Run 决策

- 负控检测结果：**Pass**（指定的 3 个 seeded defects 全部被检出）。
- 报告交付结果：**Fail / rejected**（符合负控预期）。
- 材料边界：**Pass**；排除文件内容未泄露，解析失败文件未作为证据。
- 执行边界：**Pass**；无真实 Provider 或 Apply。
- G0 证据状态：不变；本次只校准检测与计分流程。
