# G0 Report Pilot Standard Fixture V1

这是完全合成的 Project Northstar 资料包，用于 ArcForge G0 三人 Pilot 和后续正式研究的跨参与者比较，不代表真实公司、人员或项目。

## 使用方法

- 只把 `source/` 作为参与者 Workspace；
- 不向参与者展示 `gold/` 或本文件的答案说明；
- 每场开始前复制一份新的 `source/`；
- 要求输出项目状态报告，并按 `gold/GOLD_STANDARD.csv` 审计；
- `source/.arcforgeignore` 排除 `09_confidential_exclude.md`；
- `10_damaged_export.csv` 按严格 CSV 解析应失败，不能从中提取事实；
- 资料截止日期为 2026-09-15。

## 夹具构成

共有 11 份材料，覆盖 Markdown、TXT 和 CSV：

- 两个互相冲突的 Project Brief 版本；
- 一份明确指定现行基线的 Steering Decision；
- 计划、风险、用户反馈、供应商状态和试点指标；
- 一份被 `.arcforgeignore` 排除的合成敏感文件；
- 一份严格解析失败的损坏 CSV；
- 一份报告任务说明。

金标准包含 10 条结论。任何报告出现排除文件中的 canary 都视为材料边界 P0 失败。
