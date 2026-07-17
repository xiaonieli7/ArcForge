# ArcForge 阶段路线与验收门

## 总原则

> 通用架构、窄场景首发、逐能力认证。

每种场景必须定义 `Input / Artifact / Tools / Effects / Evidence / Evaluator`。未认证的模型、Runtime、Skill、MCP 或 Capability 不能由 Agent 自动调用。

## G0：产品与场景收敛

目标：证明“帮助人完成 Work”不是无边界口号。

交付：

- 主场景：资料文件夹 → 带引用报告。
- 第二场景：Issue → 补丁、测试和 Diff。
- 12–15 名目标用户访谈与真实工作观察。
- 当前 Codex 与其他桌面/CLI Agent 的工作流对比。
- Workspace、Task、Artifact、Evidence、Effect 术语冻结。
- 数据边界、隔离 Workspace 和 Trusted Broker ADR。

Go 条件：

- ≥2/3 访谈对象每周遇到资料整合、跨工具执行、审查或模型锁定问题；
- ≥5 名用户愿意使用真实工作材料参加 Private Alpha；
- 用户能够清楚理解“草稿、应用、外部动作和记忆”的差别。

## G1：Work Kernel PoC

目标：建立与具体 Runtime 无关的产品骨架。

交付：

- `ARCFORGE_HOME`、版本迁移和 SQLite Event Store；
- Task、Artifact、Evidence、Effect、Approval、MemoryCandidate Schema；
- Mock AgentBackend 与 Mock CapabilityProvider；
- Runtime/Capability Registry；
- 三栏 UI 的可点击原型；
- 重启后的事件确定性投影。

Go 条件：

- UI 状态全部来自结构化事件；
- 事件重复、乱序和尾部损坏不会产生重复 Effect；
- Runtime、Skill 和 MCP 无法直接访问 Secret 或 `.arcforge` 根目录。

## G2：只读 Work Alpha

目标：交付“资料到报告”的只读闭环。

交付：

- 一个认证模型 + 自定义 Provider Beta；
- 本地文件读取、材料索引、引用和 Evidence；
- 报告 Artifact 预览；
- Project/User Skills 发现和显式启用；
- MCP 配置与连接测试，执行默认关闭；
- Memory Candidate 提议、查看和删除。

安全门：

- 用户真实 Workspace 写入为 0；
- Shell、第三方 MCP、Hook 和 Computer Use 执行为 0；
- 凭据进入普通日志和诊断包为 0。

## G3：可信执行闭环

目标：允许生成并应用受控交付物。

交付：

- Trusted Execution Broker；
- 隔离 Task Workspace；
- ChangeSet、预览、Apply、冲突和恢复对账；
- 受控文档/表格输出；
- 任务范围审批和幂等 Effect；
- Windows 进程、文件、网络和 Secret 安全 PoC。

Go 条件：

- 未经授权 Effect 为 0；
- 用户并发修改不会被静默覆盖；
- 应用中途崩溃可对账、恢复或明确人工处理；
- 用户正确理解 Effect 范围的比例 ≥90%。

## G4：Coding Runtime 认证

目标：将编码作为认证工作域接入。

交付：

- GrokBuildCodingAdapter 接纳 PoC；
- ACP fixture、Sidecar Supervisor 和能力矩阵；
- 代码 Diff、测试 Evidence、取消和恢复；
- 固定二进制、Hash、SBOM 和许可证审查。

Go 条件：

- 关键结构化事件映射完整；
- Code Effect 全部经过 Broker/隔离 Workspace；
- Plan 不改变用户 Workspace 或外部业务系统；
- 100 次启动退出无孤儿进程；
- 无法满足时只保留 Ask/Plan，或更换 Runtime。

## G5：Private Alpha

目标：10–20 名 Windows 专业用户完成两个真实工作闭环。

验证：

- 文件夹 → 报告；
- Issue → 补丁、测试和 Diff；
- 自定义模型；
- 至少一个显式 Skill 或认证 MCP。

建议门槛：

- ≥70% 用户在 15 分钟内得到首个可验证结果；
- 交付物保留或仅小改后接受率 ≥70%；
- 典型任务阻塞审批中位数 ≤2；
- W2 留存 ≥40%；
- 未授权 Effect、目录逃逸和凭据泄漏为 0。

## G6：复用与多 Agent 实验

顺序：

1. Work Recipes 与 Workspace 模板；
2. 多 Agent 对同一不可变 Snapshot 并行只读调查；
3. 独立 Workspace 的并行 Artifact 生成；
4. 结果合并和冲突治理；
5. 最后才评估需要外部 Effect 的多 Agent 编排。

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
