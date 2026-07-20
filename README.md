# ArcForge

ArcForge 是一款面向 Windows 专业用户的、本地优先桌面 Work Agent。

它的目标不是成为“什么都能做的聊天机器人”，而是把用户目标和本地上下文转化为可审查的交付物、可验证的证据，以及需要明确授权的真实动作。

## 产品闭环

```text
Goal + Acceptance Criteria + Context + Capability Budget
                          ↓
                         Plan
                          ↓
               Observable Execution
                          ↓
              Artifacts / Proposed Effects
                          ↓
                Review / Approval / Evidence
                          ↓
                    User Acceptance
                          ↓
               Scoped Memory Candidate
```

每个完成的任务至少产生一项：

- 可审查的交付物；
- 带来源的结论；
- 已验证的动作回执；
- 明确说明无法完成及其原因。

## 产品演进场景

Core Private Alpha 的唯一英雄场景是：

> 资料文件夹 → 带引用报告 → 审查 → 保存并获得 ApplyReceipt（保存记录）。

`Issue → 代码补丁、测试证据和 Diff` 是下一认证工作域，不属于 Core Private Alpha 的 Go 条件。编码是 ArcForge 的一个可扩展工作域；Grok Build 只是候选 `GrokBuildCodingAdapter`，不是 ArcForge 的产品或架构中心。

## 核心架构

```text
ArcForge Desktop UI
        ↓
Work Kernel / Application Core
        ├── AgentBackend Registry
        ├── Artifact / Evidence / Effect
        ├── Policy / Approval / Memory
        ├── Storage Broker / Event Store
        └── Trusted Execution Broker
                ├── Files / Workspace
                ├── Process / Shell
                ├── Browser / Computer Use
                ├── Documents / Spreadsheets
                ├── MCP / Network
                └── Secrets
```

Runtime 只能提出工具意图；真实文件、进程、网络、凭据和外部系统动作必须经过 ArcForge 的可信执行边界。

## 本地数据

ArcForge 借鉴 `CODEX_HOME` 的分层思想，使用自己的本地目录和格式：

```text
默认：%USERPROFILE%\.arcforge
覆盖：ARCFORGE_HOME=<path>
```

在常见 Windows 安装中表现为：

```text
C:\Users\<user>\.arcforge
```

密钥不以明文写入该目录，真实凭据存入 Windows Credential Manager；`.arcforge` 中仅保存引用。

## 当前状态

项目当前处于 G0 产品与架构契约收敛评审阶段，尚未冻结，也尚未开始生产代码。

产品与交付范围：

- [MVP PRD V1](docs/product/MVP_PRD_V1.md)
- [G0 退出检查表](docs/product/G0_EXIT_CHECKLIST.md)
- [产品愿景](docs/PRODUCT_VISION.md)
- [Codex 桌面产品基准与对齐分析](docs/research/CODEX_PRODUCT_BASELINE_2026-07.md)
- [Codex Windows 桌面真实走查计划 V1](docs/research/CODEX_WINDOWS_WALKTHROUGH_PLAN_V1.md)
- [Codex Windows 桌面走查执行包 V1](docs/research/CODEX_WINDOWS_WALKTHROUGH_RUNBOOK_V1.md)
- [G0 用户研究与英雄场景验证计划 V1](docs/research/USER_RESEARCH_PLAN_V1.md)
- [G0 三人 Pilot 执行手册 V1](docs/research/G0_PILOT_RUNBOOK_V1.md)
- [G0 标准报告夹具 V1](fixtures/g0/report-pilot/README.md)
- [Grok Build Runtime Adapter 接纳评估 V1](docs/runtime/GROK_BUILD_ADAPTER_ASSESSMENT_V1.md)
- [Research & Report Work Pack V1](docs/work-packs/RESEARCH_REPORT_V1.md)
- [UI 低保真线框 V1](docs/design/UI_WIREFRAMES_V1.md)
- [阶段路线与验收门](docs/ROADMAP.md)
- [G1 Trusted Execution Broker 技术 Spike 计划 V1](docs/engineering/G1_TRUSTED_EXECUTION_SPIKE_PLAN_V1.md)

平台与安全合同：

- [目标架构](docs/ARCHITECTURE.md)
- [领域模型 V1](docs/specs/DOMAIN_MODEL_V1.md)
- [桌面/Runtime/Capability 协议 V1](docs/specs/PROTOCOL_V1.md)
- [安全威胁模型 V1](docs/security/THREAT_MODEL_V1.md)
- [ArcForge Home 本地存储规范](docs/ARCFORGE_HOME.md)
- [架构决策记录](docs/adr/README.md)

## 参考原则

- 借鉴 Codex 的任务中心化、结构化活动、Skills、MCP 和本地状态分层。
- 不复制 OpenAI/Codex 的商标、视觉资产或内部文件格式。
- Grok Build 只通过可替换 Adapter 接入。
- 通用架构、窄场景首发、逐能力认证。
