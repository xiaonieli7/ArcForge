# ADR-0006：Grok Build 是候选 Coding Adapter

状态：Proposed

## 背景

Grok Build 提供编码 Agent 循环、ACP、Tool Call 和 Workspace 能力，但其 UI、私有扩展、Windows Sandbox 和恢复语义不能定义 ArcForge 的通用产品架构。

## 决策

- Grok Build 注册为 `GrokBuildCodingAdapter`，不是默认 Work Kernel。
- 固定上游版本，通过 Sidecar/ACP 接入，不解析 TUI。
- 只有通过结构化事件、不可绕过的 Broker/OS Sandbox、取消、恢复、自定义模型、许可证和供应链门槛后，才能进入 Code Execute。
- Task Workspace 与 Job Object 不算 OS Sandbox；若 Runtime 仍有直接文件、网络、Secret 或进程权限且无法被隔离，则禁止启动，不能用 Plan 标签降级绕过。
- 接纳结论只能是原版 Sidecar、最小受控 Fork 或淘汰替换。

## 后果

- 非编码 Research & Report 不依赖 Grok Build。
- UI 和 Domain 不得引用 Grok Build 私有类型。
- 需要 Runtime Capability Manifest、Wire Fixture 和版本兼容矩阵。
- 详细源码证据、路径比较与 P0 接纳矩阵见 [Grok Build Runtime Adapter 接纳评估 V1](../runtime/GROK_BUILD_ADAPTER_ASSESSMENT_V1.md)。
