# G1 Broker 合同机器化评审 V1

状态：`G1 contract review candidate`；Draft，不是 G1 Go 或 `Contract Frozen`

日期：2026-07-20

## 1. 目的与边界

本评审把 [Broker Contract Decisions V0](BROKER_CONTRACT_DECISIONS_V0.md) 的 BC-01 至 BC-08 转成封闭 JSON Schema、正负例和 Canonical Hash 黄金向量，以便 G1 Week 1 能从同一合同开始实现。

本轮允许：静态合同、合成数据、纯函数校验和独立审查。本轮禁止：Broker Runtime、SQLite、真实 Runtime/Provider/Secret、真实 Workspace、网络/进程、Apply 或其他 Effect。通过本评审不等于正式 G0 通过、G1 Go 或 `Contract Frozen`。

## 2. 评审资产

| 资产 | 目的 | 信任结论 |
|---|---|---|
| [Contract Schema](../../contracts/v0/arcforge-contracts.schema.json) | 固化 Command、Intent、Grant、Resource、Spec、Preview、Policy、Approval、Authorization 和 Receipt 的字段、类型、枚举与 closed-schema 行为 | 只证明可表达的结构约束 |
| [Canonical Hash Registry](../../contracts/v0/canonical-hash-registry.json) | 固定 9 个 self-hash 与 2 个派生 Hash 的对象类型、Schema、域和排除字段 | Fixture 不能自选 Hash 安全语义 |
| [Valid Contract Bundle](../../contracts/v0/examples/valid-contract-bundle.json) | 提供单一完整引用图和按拓扑真实重算的 Hash 正例 | 不证明真实执行 |
| [Invalid Contract Cases](../../contracts/v0/examples/invalid-contract-cases.json) | 验证未知字段、缺失绑定、Raw Secret、错误版本和非法状态被拒绝 | 不替代 Fuzz |
| [Canonicalization Vectors](../../fixtures/g1/contracts/canonicalization-vectors.json) | 固定 JCS、域分离 SHA-256、exact args bytes、完整 Spec/Preview 与 Bundle Hash 链 | 当前仅有 JavaScript 参考实现证据 |
| `tools/verify_contract_schema.py` | 校验 Schema、正负例和跨对象绑定 | 评审工具，不进入 TCB |
| `tools/verify_contract_vectors.mjs` | 校验黄金向量和拒绝案例 | 评审工具，不进入 TCB |

## 3. BC-01 至 BC-08 可追溯性

| 决策 | 本轮固化 | 仍留给 G1 的证明 |
|---|---|---|
| BC-01 Canonical Hash | 词法整数、fatal UTF-8、固定 Registry、域分离、Args bytes、完整 Spec/Preview 和 Bundle Hash 向量 | Rust/第二实现逐字节一致、Fuzz、locale/replay |
| BC-02 Trusted clock | epoch、trusted UTC、monotonic ticks、TTL 字段与绑定 | sleep/restart/rollback 故障注入和执行前竞态 |
| BC-03 Fencing | V0 仅开放 Workspace/DataEgress，scope 与对象 ID/Provider 精确绑定，token/epoch/一次使用封闭 | durable high-water、双进程、旧 worker 和事务 CAS |
| BC-04 ResourceIdentity | Volume/File ID、parent/root identity、空 stream/reparse chain、revision/hash | Windows Handle 走查、TOCTOU、hardlink/reparse 负测 |
| BC-05 Late Receipt | Receipt 来源验证、独立接收 epoch、Sanitized Receipt、迟到与终态限制 | 迟到/重复/冲突/伪造 Receipt 的事件投影与 canary |
| BC-06 Multi-resource | 封闭 leaf outcome、ResourceOperationSet Hash、集合相等/唯一/排序和确定性聚合 | Apply crash 和 UI 投影一致性 |
| BC-07 Schema negotiation | protocol/schema 精确版本、所有权威对象拒绝未知字段 | 握手、升级、未知 Event replay 和 Adapter 隔离 |
| BC-08 Secret handle | 只允许 `secret_ref`，禁止 Raw Secret 字段和跨边界 handle | TCB 私有单次 handle、并发消费、canary 和 crash dump |

## 4. 通过门

- [x] Schema 自身通过 Draft 2020-12 元校验；
- [x] 49 个权威/嵌套对象 Schema 全部 closed；11 个核心定义存在；
- [x] 合成正例通过结构、跨对象绑定、PolicyAllow/Deny 分支和 Hash 拓扑校验；
- [x] 56/56 负例按预期层拒绝，包括未知字段、Raw Secret、scope/epoch/fencing、Preview/Receipt 和非法 Endpoint；
- [x] Canonicalization、域分离 Hash、Args bytes、完整 Spec/Preview 和 Registry Bundle 黄金向量全部通过；
- [x] 17 个 JSON/profile 拒绝、3 个非法 UTF-8 拒绝和 6 个 Hash 关系检查通过；
- [x] Receipt 逐资源 outcome、集合 Hash 与领域映射没有把 Partial/Conflict/Unknown 误报为 Applied；
- [x] 独立审查结论为 P0=0、P1=1、P2=1；P1 已指定 G1 Owner 和冻结前 Stop 条件；
- [x] 150 个 Markdown 本地链接、`git diff --check` 和正向敏感字段扫描通过。

## 5. 不构成通过的事项

以下结论不能由 JSON Schema 或参考校验器推出：

- SQLite `effect.authorized + authorization_ledger + outbox` 的原子提交；
- 单调时钟在 Windows sleep/hibernate、重启和虚拟机恢复下的语义；
- fencing counter 的 durable high-water 与旧进程隔离；
- NTFS Handle、File ID、reparse/hardlink 和 Apply TOCTOU 的可行性；
- Secret buffer 的生命周期、清零和 canary 不落盘；
- Receipt sanitizer/scanner 能否在真实 Provider 回显 Authorization/header 时保持 canary 为 0；
- Trusted Preview Renderer 是否只从 closed PreviewBinding 确定性渲染，并与实际 invoke bytes 一致；
- Endpoint 的 DNS 解析、重绑定、Redirect、Proxy 和实际网络 egress 边界；
- Provider/Workspace 的真实 Receipt、Crash 和 Reconciliation；
- 任何产品价值、可用性或正式 G0 证据。

## 6. 自动验证结果

```text
Draft 2020-12 meta-schema                          PASS
closed object schemas / core definitions          49 / 11
strict JSON boundary probes                       9 / 9
semantic authorization branches                   5 / 5
JSON Pointer negative mutations                   56 / 56
valid / invalid profile / invalid UTF-8 / relation 10 / 17 / 3 / 6
bundle registry checks                            35 / 35
total canonical/hash checks                       71
```

## 7. G1 必须关闭的实现证据

| Owner | G1 证据 | 未通过时 |
|---|---|---|
| Contracts | Rust/独立第二实现逐字节通过全部 Registry 与黄金向量；Fuzz、locale 和 100 次 replay 一致 | Stop |
| Contracts + Core | 冻结 capability/operation descriptor 与逐操作 postcondition；至少区分 create/replace/delete/DataEgress，禁止 `Applied` 携带矛盾 after-state | Stop；这是当前唯一 P1 |
| Storage | T2 原子提交、durable fencing high-water、旧 worker/claim 隔离与 Unknown 不重试 | Stop |
| Windows | NTFS Handle/File ID、reparse/hardlink、大小写、TOCTOU 和 crash apply 负测 | Workspace Effect No-Go |
| Security | Trusted Renderer WYSIWYE、URI/DNS/redirect egress、Secret canary、Receipt sanitizer/crash dump | 对应 Capability No-Go |
| Core | PolicyAllow/Deny、late receipt、partial/unknown、事件投影和 UI 不误报 | Stop |

P2：当前正式 Bundle 是单资源完整链；双资源排序/Hash 关系已有黄金向量，但双资源部分成功与 Conflict 的端到端 Bundle 留给 G1 集成 Fixture。

## 8. 评审结果

机器化合同已达到 `G1 contract review candidate`。独立审查没有 P0；唯一 P1 是 operation-specific postcondition 尚未冻结，必须在 `Contract Frozen` 前关闭。该结论只表示 G1 Week 1 有一套封闭、可重复校验的起始合同；正式 G0 产品证据仍未完成，G1 未获启动授权，合同也尚未冻结。
