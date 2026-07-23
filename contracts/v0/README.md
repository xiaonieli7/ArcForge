# ArcForge Broker Contract V0

状态：G1 contract review candidate；Draft，不是 `Contract Frozen`

本目录把 G0.5 的 Broker 设计决策转成可机器校验的合同草案。它只用于 G1 合同评审和跨实现测试，不启动 Broker Runtime、数据库、真实 Provider、Secret、Workspace Apply 或其他真实 Effect。

## 规范层级

发生冲突时按以下顺序处理，禁止由示例反向修改安全语义：

1. [Domain Model](../../docs/specs/DOMAIN_MODEL_V1.md)定义领域状态与不变量；
2. [Protocol](../../docs/specs/PROTOCOL_V1.md)定义跨边界消息和执行顺序；
3. [Broker Contract Decisions](../../docs/engineering/BROKER_CONTRACT_DECISIONS_V0.md)定义 BC-01 至 BC-08 的安全细节；
4. `arcforge-contracts.schema.json`把其中可结构化的约束固化为 JSON Schema；
5. `examples/`与 `fixtures/`只提供测试材料，不是新的规范来源。

## 版本

- `protocol_major = 1`：不兼容时拒绝写入或执行；
- `contract_schema_version = 0`：评审草案，尚不承诺迁移兼容性；
- `canonicalization_version = jcs-rfc8785-restricted-v0`：只接受词法整数、合法 UTF-8/I-JSON 和域分离 SHA-256。

任何安全对象新增、删除或重解释字段，都必须提升合同版本、更新黄金向量，并重新完成 Preview、Policy、Approval、Authorization 和 Receipt 的绑定评审。不能依靠 minor 版本忽略未知字段。

## 文件

- `arcforge-contracts.schema.json`：封闭的权威/安全对象 Schema；
- `canonical-hash-registry.json`：固定对象类型、Schema、域、self-hash 排除字段和两个派生 Hash，测试夹具不能自行改写安全语义；
- `examples/valid-contract-bundle.json`：贯穿 Command、Intent、Resource、Grant、Spec、Preview、Policy、Approval、Authorization 和 Receipt 的单链合成正例；
- `examples/invalid-contract-cases.json`：在正例上施加的负向变异；
- `../../fixtures/g1/contracts/canonicalization-vectors.json`：Canonical JSON、域分离 Hash、Args bytes 和 Preview binding 黄金向量；
- `../../tools/verify_contract_schema.py`：Schema、正例、负例与语义不变量检查；
- `../../tools/verify_contract_vectors.mjs`：不依赖第三方包的 Canonical Hash 校验器。

## 安全配置

- 49 个对象 Schema 均为 closed schema，未知字段必须拒绝；评审 Bundle 每类恰好一个对象，避免未被引用的 orphan 绕过全链检查；
- JSON number 只允许词法形式的安全范围整数；64 位计数、精确值和 fencing token 使用无前导零十进制字符串并校验 uint64 上界；
- `secret_ref`是非秘密引用；合同中禁止 Raw Secret、Secret bytes 和可跨边界复用的临时 Secret Handle；
- `ResourceIdentity`绑定 NTFS Volume/File ID 与预期 revision/hash，字符串路径不构成授权身份；
- V0 Effect 只开放 `WorkspaceMutation | DataEgress`；Process、Shell、外部业务写和 Memory Persist 继续 `FeatureDisabled`，直到新版本提供封闭 scope；
- `Command → ToolIntent → InvocationSpec`有显式 causation/correlation 与 source intent 绑定；
- Preview 是封闭的结构化合同，绑定 Spec、Args、Resource 和可信 Renderer；Hash 不包含 HTML、Provider 文本或渲染产物；
- Policy、Approval、Authorization 和 Receipt 绑定同一个 sealed InvocationSpec/Preview 链；Policy `Allow`只免人工审批，不免 Preview 或 Authorization；
- Receipt 只持久化带脱敏策略和 Clean scan attestation 的 `SanitizedReceiptRef`，不持久化原始回执；
- 逐资源 Receipt 与领域 Effect 状态是两层枚举，聚合规则由 Protocol 和 BC-06 决定；
- Registry 校验按依赖拓扑重算 9 个 self-hash 和 `CommandPayloadRef`、`ResourceOperationSet` 两个派生 Hash；
- JSON Schema 和评审工具仍不能证明真实单调时钟、fencing high-water、一次性消费、事务原子性、URI/DNS 网络边界、Windows Handle/TOCTOU、Secret 清零或真实状态转换，这些必须由 G1 实现与故障注入证明。

## 本地校验

在仓库根目录运行：

```powershell
python tools/verify_contract_schema.py
node tools/verify_contract_vectors.mjs
```

Schema 校验工具需要 Python `jsonschema` 4.x；Hash 校验工具只使用 Node.js 内置模块。两项通过只表示合同资产内部一致，不表示 G0、G1 或任何 Capability 已通过。

当前基线输出：

```text
schema: 49 closed objects, 11 core definitions, 56/56 negative mutations
hash:   71 checks, including 35 registry/bundle checks
```
