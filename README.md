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

## 第一阶段场景

1. 资料文件夹 → 带引用的可交付报告。
2. Issue → 代码补丁、测试证据和 Diff 审查。

编码是 ArcForge 的一个认证工作域。Grok Build 是候选 Coding Runtime，不是 ArcForge 的产品或架构中心。

## 核心架构

```text
ArcForge Desktop UI
        ↓
Work Kernel / Application Core
        ├── AgentBackend Registry
        ├── Artifact / Evidence / Effect
        ├── Policy / Approval / Memory
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

项目当前处于产品定义和架构冻结阶段，尚未开始生产代码。

- [产品愿景](docs/PRODUCT_VISION.md)
- [目标架构](docs/ARCHITECTURE.md)
- [ArcForge Home 本地存储规范](docs/ARCFORGE_HOME.md)
- [阶段路线与验收门](docs/ROADMAP.md)

## 参考原则

- 借鉴 Codex 的任务中心化、结构化活动、Skills、MCP 和本地状态分层。
- 不复制 OpenAI/Codex 的商标、视觉资产或内部文件格式。
- Grok Build 只通过可替换 Adapter 接入。
- 通用架构、窄场景首发、逐能力认证。
