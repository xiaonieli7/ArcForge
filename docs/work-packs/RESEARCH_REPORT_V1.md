# Research & Report Work Pack V1

状态：Draft for G0 review

目标版本：Private Alpha

主平台：Windows 11 x64
数据范围：本地 NTFS Workspace

## 1. 产品目标

帮助用户把一个本地资料文件夹转化为带可追溯引用、可审查并可导出的报告 Artifact。

示例任务：

> 分析这个项目文件夹，整理当前产品需求、风险和待确认事项，输出一份结构完整、每项关键结论都有来源的评审报告。

本 Work Pack 证明 ArcForge 能完成一个非编码数字工作闭环，而不只是上传文件后生成摘要。

## 2. 目标用户

- 产品经理；
- 分析师；
- 顾问；
- 研究人员；
- 运营人员；
- 需要整理项目资料的开发者。

用户应能理解 Workspace、资料来源、模型 Provider 和交付物审查。不面向需要完全无人值守执行的普通消费者。

## 3. Job to be Done

当我面对一个包含多份资料的项目文件夹时，我希望 ArcForge 能按照我的目标调查、归纳并生成一份有来源的报告，使我减少重复阅读和整理时间，同时仍然能够验证每个关键结论并控制最终写入。

## 4. 输入范围

### 4.1 V1 支持

| 格式 | 支持等级 | 引用定位 |
|---|---|---|
| Markdown | 完整 | 标题、行号 |
| TXT | 完整 | 行号 |
| 文本型 PDF | 完整 | 页码、文本片段 |
| DOCX | 完整 | 标题、段落、表格 |
| CSV | 基础 | 行列范围 |
| XLSX | 基础 | Workbook、Sheet、单元格范围 |

“基础”表示支持读取、预览、抽取和引用，不承诺复杂公式计算、宏、数据透视表和格式保真编辑。

### 4.2 V1 不支持

- 扫描型 PDF 和 OCR；
- PPTX；
- 音视频转写；
- 邮箱批量导入；
- 自动全网研究；
- 加密或密码保护文件；
- 宏执行；
- Workspace 外部文件自动发现。

不支持的文件必须在材料清单中明确显示，不能静默忽略。

## 5. 输出范围

### 5.1 内部 Artifact

报告不能只保存为一段 Markdown 字符串。内部使用结构化 `DocumentArtifact`：

```text
DocumentArtifact
├── artifact_id
├── schema_version
├── title
├── sections[]
│   ├── heading
│   ├── blocks[]
│   └── citations[]
├── tables[]
├── findings[]
├── assumptions[]
├── unresolved_questions[]
├── warnings[]
├── validation_results[]
└── provenance
```

### 5.2 导出

- Markdown：V1 必须；
- DOCX：Private Alpha 必须；
- 引用清单 Markdown/JSON：V1 必须；
- PDF：后置，不作为 V1 发布门。

导出文件先生成在隔离 Task Workspace，用户审查后才写入真实 Workspace。

## 6. Source 与 Citation

### 6.1 SourceDescriptor

```text
source_id
workspace_id
relative_path
media_type
size
sha256
modified_at
parser_id/parser_version
sensitivity
index_status
extracted_at
```

### 6.2 Citation

```text
citation_id
source_id
locator_type
locator
quoted_excerpt_hash
claim_id
created_at
```

Locator 示例：

```text
requirements.docx · “权限设计”章节 · 第 3 段
market-report.pdf · 第 12 页
sales.xlsx · Sheet1 · B12:F18
README.md · 第 25–40 行
```

规则：

- 每个关键 Finding 至少一个 Citation；
- 引用只保存必要短摘录和 Hash，避免重复存储大段敏感内容；
- 应用/导出前重新校验 Source Hash；
- 来源变化时标记 `stale`，不得继续显示为已验证；
- 无来源内容必须标记为 `assumption` 或 `model_suggestion`。

## 7. 核心实体

```text
ResearchTask
├── Goal
├── AcceptanceCriteria[]
├── SourceSet
├── ResearchPlan
├── AgentRun
├── Findings[]
├── DocumentArtifact
├── Evidence[]
├── ApplyEffect
└── MemoryCandidates[]
```

任务完成不能只依赖模型声明。必须由 Acceptance Criteria 和 Evidence 判定。

## 8. 完整用户流程

```text
选择本地 Workspace
→ 扫描支持/不支持文件与敏感风险
→ 展示材料清单和数据目的地
→ 用户输入 Goal
→ ArcForge 提议 Acceptance Criteria
→ 用户确认 Plan
→ 读取、解析、索引资料
→ 展示聚合后的调查活动
→ 生成 Report Artifact
→ 检查引用、遗漏、矛盾和来源变化
→ 用户审查 Deliverable 与 Evidence
→ Apply 到真实 Workspace 或放弃
→ 提议 Workspace/User Memory
→ 用户确认、编辑或拒绝 Memory
```

## 9. 执行模式

### Plan

- 可以列出和读取用户已选择 Workspace 内的支持文件；
- 可以调用用户已选择并已展示的数据目的地模型；
- 不写真实 Workspace；
- 不执行 Shell、Skill Script、第三方 MCP 或额外 Web；
- 不生成真实外部 Effect。

### Execute

- 在隔离 Task Workspace 生成 Artifact；
- Apply 前显示目标路径、覆盖范围和冲突；
- 真实 Workspace 写入需要用户确认；
- 不允许自动发送报告或更新外部系统。

## 10. Capability Pack

V1 允许：

```text
workspace.list
workspace.read
document.parse
spreadsheet.read
source.index
model.generate
artifact.create
artifact.validate
artifact.export.markdown
artifact.export.docx
workspace.apply
memory.propose
```

V1 禁止：

```text
process.spawn
shell.execute
computer.use
browser.act
email.send
saas.write
mcp.unverified
workspace.external_read
```

每个 Capability 的输入、输出、Effect、超时和最大资源量必须进入认证矩阵。

## 11. UI 规格

```text
左侧
Workspace / Thread / Task

中间
Goal / Acceptance Criteria / Plan / Activity Timeline

右侧
Report | Sources | Evidence | Actions

底部
Composer / Plan-Execute / Model / Enabled Capabilities
```

### 11.1 Workspace 扫描

展示：

- 文件总数和总大小；
- 支持、不支持和失败数量；
- 可能的敏感文件；
- `.arcforgeignore` 生效结果；
- 当前模型 Provider 与 Endpoint。

### 11.2 Activity Timeline

高频读取事件必须聚合：

```text
正在建立材料索引
已处理 18/24 个文件
2 个文件不受支持
```

不逐条刷屏，也不展示模型私有推理。

### 11.3 Report Review

支持：

- 章节导航；
- Citation 跳转；
- Findings、Assumptions、Questions 分组；
- 查看来源状态；
- 继续提出修改；
- 导出预览；
- Apply 或放弃。

## 12. 关键事件

```text
workspace.scan.started/completed/failed
source.discovered/unsupported/parse_failed/indexed/stale
task.acceptance_criteria.proposed/accepted
plan.updated
research.progress
finding.created/updated
citation.created/invalidated
artifact.created/updated/validated/exported
effect.apply.proposed/approved/applied/failed/unknown
memory.candidate.proposed/accepted/rejected
task.completed/failed/canceled
```

所有 UI 状态来自结构化事件，不解析 Agent 文本判断阶段。

## 13. 隔离与 Apply

```text
真实 Workspace 基线
→ Task Workspace
→ 生成 Markdown/DOCX
→ 计算 ChangeSet
→ 用户审查
→ 重新校验目标文件
→ Apply Journal
→ 原子写入或明确失败
→ Evidence Receipt
```

规则：

- 默认只创建新输出文件，不自动覆盖原始资料；
- 目标文件已存在时必须请求确认；
- 用户或外部应用修改目标后，禁止静默覆盖；
- Apply 中断后启动时必须对账；
- “生成成功”与“已保存到真实 Workspace”是两个不同状态。

## 14. Memory

V1 可提议：

- 用户报告格式偏好；
- Workspace 的稳定术语和背景；
- 用户确认的事实；
- 可复用的报告流程。

禁止记忆：

- API Key、Token、Cookie；
- 原始敏感附件全文；
- 未经确认的模型推断；
- 第三方个人隐私信息；
- 用户拒绝的内容。

Memory 默认是 Candidate，只有用户确认后才能提升到 Workspace/User Scope。

## 15. 验收标准

### 功能

- 支持格式能够正确进入 SourceSet；
- 不支持和解析失败文件全部可见；
- 报告成功生成并可预览；
- Markdown/DOCX 导出符合结构要求；
- 用户可跳转到每个关键 Finding 的来源；
- 用户可以放弃 Task Workspace 而不改变真实 Workspace；
- Apply 结果产生结构化 Receipt。

### 质量

- 关键 Finding Citation 覆盖率 ≥95%；
- 不存在来源的事实性结论必须标为假设；
- Citation 指向错误来源的比例 <2%；
- 报告章节和 Acceptance Criteria 覆盖率 ≥90%；
- 产生 Artifact 的任务中，用户保留或仅小改后保留比例目标 ≥70%。

### 安全

- 未经批准的真实 Workspace 写入为 0；
- Workspace 外读取为 0；
- Secret 进入 Event、Memory、普通日志和诊断包为 0；
- Plan 模式的 Shell、MCP、Computer Use 和外部业务 Effect 为 0；
- Source 路径穿越和 junction/reparse point 逃逸为 0。

### 体验

- ≥80% 测试用户无需帮助完成 Workspace → Report → Review → Save；
- ≥90% 用户正确判断报告是否已写入真实 Workspace；
- ≥90% 用户能够确认代码/资料将发送到哪个 Provider；
- 首个可审查 Artifact 的时间需要在真实基线测试后冻结目标。

## 16. 测试数据集

至少准备：

1. 10 个 Markdown/TXT 小型 Workspace；
2. 5 个包含目录、表格和交叉引用的 DOCX Workspace；
3. 5 个文本 PDF Workspace；
4. 5 个 CSV/XLSX 混合 Workspace；
5. 文件名包含中文、空格、长路径和 Unicode 的样本；
6. 损坏、超大、受密码保护和不支持格式样本；
7. 包含互相矛盾事实的资料；
8. 包含敏感字符串和 `.arcforgeignore` 的资料；
9. 审查期间外部修改 Source/目标文件的并发样本。

每个数据集必须有人工标注的关键事实、来源和期望报告结构，用于比较模型与 Runtime。

## 17. 性能与限制

Private Alpha 建议初始限制：

- 单 Workspace 最多 500 个文件；
- 单任务索引内容上限按提取文本大小配置；
- 单文件大小和总附件大小必须显式显示；
- 超出上下文时采用检索和分段，不静默截断；
- UI 必须允许取消索引和生成；
- 关闭应用后不继续后台执行。

具体数值必须通过 PoC 和真实材料测量后冻结，不能直接承诺。

## 18. 非目标

- 替代完整知识库或企业搜索；
- 保证任意 PDF/DOCX/XLSX 完美解析；
- 自动判断所有资料的真实性；
- 无人监督发布报告；
- 自动向第三方发送结果；
- 任意模型都能达到相同报告质量；
- 将所有历史对话自动保存为 Memory。

## 19. G0 待确认

1. Private Alpha 默认导出是否确定为 Markdown + DOCX。
2. PDF 是否仅支持文本型文件。
3. CSV/XLSX 第一版是否只读，不编辑源表格。
4. Web Research 是否完全后置。
5. 默认报告文件名和输出目录规则。
6. 引用短摘录的本地保存与脱敏策略。
7. 第一批 5–10 个真实 Workspace 样本来源。
