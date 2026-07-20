# ArcForge 阶段路线与验收门

## 总原则

> 通用架构、窄场景首发、逐能力认证。

每种场景必须定义 `Input / Artifact / Tools / Effects / Evidence / Evaluator`。未认证的模型、Runtime、Skill、MCP 或 Capability 不能由 Agent 自动调用。

以下周次是以项目启动为第 1 周的 22 周 Private Alpha 目标窗口。阶段门优先于日期；未达门时顺延，不得绕过安全门压缩范围。

## G0：产品与场景收敛（第 1–2 周）

目标：证明“帮助人完成 Work”不是无边界口号。

交付：

- 主场景：资料文件夹 → 带引用报告。
- 下一认证场景：Issue → 补丁、测试和 Diff，仅用于验证架构可扩展性，不进入 Core Private Alpha。
- 按 [G0 用户研究与英雄场景验证计划](research/USER_RESEARCH_PLAN_V1.md)完成 12–15 名目标用户访谈与真实工作观察。
- 当前 Codex 与其他桌面/CLI Agent 的工作流对比，并执行 [Codex Windows 桌面真实走查计划](research/CODEX_WINDOWS_WALKTHROUGH_PLAN_V1.md)。
- Workspace、Thread、Task、AgentRun、Artifact、Evidence、Effect、Approval、Source、Citation、ChangeSet、ApplyReceipt、MemoryCandidate 术语冻结。
- 数据边界、隔离 Workspace 和 Trusted Broker ADR。

Go 条件：

- 至少获得 12 份有效样本，且 ≥8/12 每月真实发生该任务两次以上；
- ≥8/12 对英雄场景价值评分达到 5/7，并能指出被替代步骤；
- ≥6/12 愿意在 14 天内带第二个真实任务继续使用，且 ≥5 人愿意使用真实脱敏材料参加 Private Alpha；
- Provider/Endpoint、外发范围和 Apply 前 Workspace 状态理解率 ≥90%；≥90% 区分 Accepted、Applied 与 Succeeded；
- 满足 [G0 用户研究计划](research/USER_RESEARCH_PLAN_V1.md)定义的至少一项价值强信号，且无材料越界或错误成功提示。

## G0.5：限界技术预研（与 G0 证据收敛并行，5 个工作日）

状态：Completed on 2026-07-20 — Ready for G1 contract review；正式 G0 产品证据仍未完成。

依据 [G0 加速决策](product/G0_ACCELERATION_DECISION_2026-07-20.md)，三人外部 Pilot 改为两次合成夹具内部 Dry Run，并允许执行 [G0.5 Broker 限界预研](engineering/G0_5_BROKER_PRE_SPIKE_V1.md)。

允许产出 Broker 合同冻结清单、Threat-to-Test 矩阵、Event Store 设计和 Mock Backend Fixture Catalog。禁止生产代码、真实 LLM/Provider/Secret、真实 Workspace、网络/进程/外部 Effect、Grok Build 接入，以及任何 G0/G1 Go 声明。

G0.5 通过只表示材料可进入 G1 合同评审；正式产品证据门和 G1 启动决定保持不变。

## G1：Work Kernel 与执行边界 PoC（第 3–7 周）

目标：建立与具体 Runtime 无关的产品骨架。

交付：

- `ARCFORGE_HOME`、版本迁移和 SQLite Event Store；
- Task、Artifact、Evidence、Effect、Approval、MemoryCandidate Schema；
- Mock AgentBackend 与 Mock CapabilityProvider；
- Runtime/Capability Registry；
- 三栏 UI 的可点击原型；
- 重启后的事件确定性投影。
- 按 [G1 Trusted Execution Broker 技术 Spike 计划](engineering/G1_TRUSTED_EXECUTION_SPIKE_PLAN_V1.md)完成可信执行可行性门：非信任 Runtime 只能提交 ToolIntent；对 Secret、`ARCFORGE_HOME`、真实 Workspace 和通用网络的直接访问必须通过负向测试。

Go 条件：

- UI 状态全部来自结构化事件；
- 重复回放和 Outbox 重试保持幂等；SQLite 完整性失败进入只读恢复；
- 测试 Sidecar、Skill 与 MCP Fixture 无法直接访问 Secret、`.arcforge` 根目录、真实 Workspace 或通用网络。

## G2：只读 Work Alpha（第 8–12 周）

目标：交付“资料到报告”的只读闭环。

交付：

- Workspace Read Broker、Provider Egress Broker MVP 与 Secret Broker MVP；
- 一个 Research & Report Certified 模型；
- 自定义 Provider Beta 只承诺配置、Secret 引用、连接测试和能力检测，未认证模型不得执行 Work Pack；
- 本地文件读取、材料索引、引用和 Evidence；
- 报告 Artifact 预览；
- Memory Candidate 提议、查看和删除。
- 每次 Provider Invocation 绑定已确认的 SourceSet、数据等级、Provider、Model、Endpoint 和 Egress Policy 快照。

安全门：

- 用户真实 Workspace 写入为 0；
- Runtime 通用网络、Shell、第三方 MCP、Hook 和 Computer Use 执行为 0；
- 所有模型流量只经过 Provider Egress Broker；
- 凭据进入普通日志和诊断包为 0。

## G3：可信 Apply 闭环（第 13–18 周）

目标：允许生成并应用受控交付物。

交付：

- Trusted Execution Broker 扩展到 Workspace Apply、文件写入和恢复对账；
- 隔离 Task Workspace；
- ChangeSet、预览、Apply、冲突和恢复对账；
- 受控文档/表格输出；
- 任务范围审批和幂等 Effect；
- Windows 文件、网络和 Secret 安全 PoC；Shell、任意进程和第三方 STDIO MCP 仍默认关闭。

Go 条件：

- 未经授权 Effect 为 0；
- 用户并发修改不会被静默覆盖；
- 应用中途崩溃可对账、恢复或明确人工处理；
- 用户正确理解 Effect 范围的比例 ≥90%。

## G4：Research & Report Private Alpha（第 19–22 周）

目标：5–10 名 Windows 专业设计伙伴完成资料到报告的真实工作闭环。

验证：

- 至少 10 个真实 Workspace 和 20 个可计量任务；
- 文件夹 → 报告 → 引用审查 → 保存并获得 ApplyReceipt；
- 一个 Research & Report Certified 模型；
- Experimental 能力只收集可用性证据，不进入 Core Go/No-Go。

建议门槛：

- 交付物保留或仅小改后接受率 ≥70%；
- 重复任务的阻塞审查中位数 ≤2：合并的数据边界/Plan Review 与 Apply Review；首次 Provider Onboarding 单独统计；
- W2 留存 ≥40%；
- 未授权 Effect、目录逃逸和凭据泄漏为 0。

“15 分钟内得到首个可验证结果”先作为产品假设；G2 必须按 Workspace S/M/L 基准冻结时间阈值后，才能升级为 Go 条件。

## G5：Coding Runtime 认证（第 22 周后独立实验轨）

目标：将编码作为独立认证工作域接入，不作为 G4 前置条件。

交付：

- [GrokBuildCodingAdapter 接纳 PoC](runtime/GROK_BUILD_ADAPTER_ASSESSMENT_V1.md)；
- ACP fixture、Sidecar Supervisor 和能力矩阵；
- 代码 Diff、测试 Evidence、取消和恢复；
- 固定二进制、Hash、SBOM 和许可证审查。

Go 条件：

- 关键结构化事件映射完整；
- Code Effect 全部经过 Broker 和隔离 Workspace；
- Task Workspace 不能被当作 OS Sandbox；具有直接文件/进程能力的 Runtime 必须处于经验证的 OS 隔离中；
- 100 次启动退出无孤儿进程；
- 无法满足时不得进入 Code Execute；可以保留无环境权限的 Plan 能力，或更换 Runtime。

## G6：复用与多 Agent 实验

顺序：

1. Work Recipes 与 Workspace 模板；
2. 多 Agent 对同一不可变 Snapshot 并行只读调查；
3. 独立 Workspace 的并行 Artifact 生成；
4. 结果合并和冲突治理；
5. 最后才评估需要外部 Effect 的多 Agent 编排。

## 非阻塞 Experimental 轨

- 模型 Profile 分级：`Connectivity Checked / Plan Eligible / Research & Report Certified / Coding Certified`；
- 下一 Task 模型切换；
- Project/User Skill 发现、来源与权限查看、显式启用，脚本关闭；
- MCP 配置和静态校验；STDIO 连接测试必须等待 Process Broker 与 OS 隔离认证；
- Checkpoint 只做诊断实验，不替代 Task Workspace、Apply Journal 或外部 Effect 对账。

这些实验不得成为 G2–G4 的 Core Go 条件。

## Stop 条件

出现以下任一情况，停止扩大开发并调整路线：

1. 无法找到至少 5 名愿意使用真实材料的设计伙伴。
2. 首个英雄场景相对现有工具没有明显价值或节省时间。
3. Trusted Broker 无法成为不可绕过的执行边界。
4. Windows 目录逃逸、未经授权 Effect 或凭据泄漏不能降为 0。
5. Task Workspace 与真实资源无法可靠对账。
6. Grok Build 关键事件必须依靠解析文本才能映射。
7. 模型、Runtime 或依赖许可证阻止合法再分发。

## 当前不开始的工作

- 生产 UI 编码；
- 全桌面 Computer Use；
- 后台长期自治；
- 任意第三方插件市场；
- 并行写同一 Workspace；
- 商业发布和账号体系。
