#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = resolve(
  HERE,
  "..",
  "fixtures",
  "g1",
  "contracts",
  "canonicalization-vectors.json",
);
const DEFAULT_REGISTRY = resolve(HERE, "..", "contracts", "v0", "canonical-hash-registry.json");
const CANONICALIZATION_VERSION = "jcs-rfc8785-restricted-v0";
const PROBE_PROFILES = Object.freeze({
  "canonicalization-probe-v0": Object.freeze({
    canonicalization_version: CANONICALIZATION_VERSION,
    object_type: "CanonicalizationProbe",
    schema_version: "0",
    omit_top_level_fields: Object.freeze([]),
  }),
  "invocation-binding-probe-v0": Object.freeze({
    canonicalization_version: CANONICALIZATION_VERSION,
    object_type: "InvocationSpecBindingProbe",
    schema_version: "0",
    omit_top_level_fields: Object.freeze(["probe_hash"]),
  }),
});
const VECTOR_PROFILE_OVERRIDE_FIELDS = Object.freeze([
  "canonicalization_version",
  "object_type",
  "schema_version",
  "omit_top_level_fields",
]);
const EXPECTED_BUNDLE_TOPOLOGY = Object.freeze({
  CommandPayloadRef: Object.freeze({
    source_pointer: "/command_envelopes/0/payload",
    derivation: "identity",
    reference_pointers: Object.freeze(["/command_envelopes/0/payload_hash"]),
  }),
  DataBoundaryGrant: Object.freeze({
    source_pointer: "/data_boundary_grants/0",
    reference_pointers: Object.freeze([
      "/tool_intents/0/data_boundary_grant/grant_hash",
      "/invocation_specs/0/data_boundary_grant/grant_hash",
    ]),
  }),
  ResourceIdentity: Object.freeze({
    source_pointer: "/resource_identities/0",
    reference_pointers: Object.freeze([
      "/tool_intents/0/resource_proposals/0/resource_identity_hash",
      "/invocation_specs/0/resources/0/resource_identity_hash",
      "/policy_decisions/0/evaluated_resource_versions/0/resource_identity_hash",
      "/approvals/0/resource_versions/0/resource_identity_hash",
      "/authorization_grants/0/resources/0/resource_identity_hash",
    ]),
  }),
  ResourceOperationSet: Object.freeze({
    source_pointer: "/invocation_specs/0/resources",
    derivation: "resource_operation_set",
    reference_pointers: Object.freeze([
      "/invocation_specs/0/expected_resource_set_hash",
      "/effect_receipts/0/expected_resource_set_hash",
    ]),
  }),
  ToolIntent: Object.freeze({
    source_pointer: "/tool_intents/0",
    reference_pointers: Object.freeze([
      "/invocation_specs/0/source_intent_hash",
      "/approvals/0/intent_hash",
    ]),
  }),
  InvocationSpec: Object.freeze({
    source_pointer: "/invocation_specs/0",
    reference_pointers: Object.freeze([
      "/policy_decisions/0/invocation_spec_hash",
      "/previews/0/invocation_spec_hash",
      "/approvals/0/invocation_spec_hash",
      "/authorization_grants/0/invocation_spec_hash",
      "/effect_receipts/0/invocation_spec_hash",
    ]),
  }),
  PreviewBinding: Object.freeze({
    source_pointer: "/previews/0",
    reference_pointers: Object.freeze([
      "/policy_decisions/0/required_constraints/1/binding_hash",
      "/policy_decisions/0/preview_hash",
      "/approvals/0/preview_hash",
      "/authorization_grants/0/preview_hash",
    ]),
  }),
  PolicyDecision: Object.freeze({
    source_pointer: "/policy_decisions/0",
    reference_pointers: Object.freeze(["/authorization_grants/0/policy_decision_hash"]),
  }),
  Approval: Object.freeze({
    source_pointer: "/approvals/0",
    reference_pointers: Object.freeze(["/authorization_grants/0/approval_hash"]),
  }),
  AuthorizationGrant: Object.freeze({
    source_pointer: "/authorization_grants/0",
    reference_pointers: Object.freeze(["/effect_receipts/0/authorization_hash"]),
  }),
  EffectReceipt: Object.freeze({
    source_pointer: "/effect_receipts/0",
    reference_pointers: Object.freeze([]),
  }),
});

class VectorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VectorError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new VectorError(code, message);
}

function assertUnicodeScalars(value, label = "string") {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("LONE_SURROGATE", `${label} contains an unpaired high surrogate`);
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail("LONE_SURROGATE", `${label} contains an unpaired low surrogate`);
    }
  }
}

function decodeUtf8Strict(bytes, label = "input") {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("INVALID_UTF8", `${label} is not well-formed UTF-8`);
  }
}

// JSON.parse accepts duplicate object members. This parser rejects duplicates at
// the raw JSON boundary before any object can be hashed. It also applies the
// ArcForge restricted-number profile while the original number token is visible.
function strictParseJson(text) {
  let position = 0;

  function syntax(message) {
    fail("JSON_SYNTAX", `${message} at byte/UTF-16 offset ${position}`);
  }

  function skipWhitespace() {
    while (
      text[position] === " " ||
      text[position] === "\n" ||
      text[position] === "\r" ||
      text[position] === "\t"
    ) {
      position += 1;
    }
  }

  function parseString(label) {
    if (text[position] !== '"') syntax("expected string");
    const start = position;
    position += 1;
    let escaped = false;
    while (position < text.length) {
      const character = text[position];
      if (escaped) {
        escaped = false;
        position += 1;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        position += 1;
        continue;
      }
      if (character === '"') {
        position += 1;
        const token = text.slice(start, position);
        let value;
        try {
          value = JSON.parse(token);
        } catch {
          syntax("invalid JSON string");
        }
        assertUnicodeScalars(value, label);
        return value;
      }
      position += 1;
    }
    syntax("unterminated string");
  }

  function parseNumber() {
    const match = text
      .slice(position)
      .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
    if (!match) syntax("invalid number");
    const token = match[0];
    position += token.length;
    const delimiter = text[position];
    if (
      delimiter !== undefined &&
      delimiter !== " " &&
      delimiter !== "\n" &&
      delimiter !== "\r" &&
      delimiter !== "\t" &&
      delimiter !== "," &&
      delimiter !== "]" &&
      delimiter !== "}"
    ) {
      syntax("invalid number delimiter");
    }
    if (token.includes(".") || token.includes("e") || token.includes("E")) {
      fail("FLOAT_FORBIDDEN", `number token ${token} is not a lexical integer`);
    }
    if (token === "-0") fail("NEGATIVE_ZERO", "negative zero is forbidden");
    const integer = BigInt(token);
    if (integer < BigInt(Number.MIN_SAFE_INTEGER) || integer > BigInt(Number.MAX_SAFE_INTEGER)) {
      fail("UNSAFE_INTEGER", `number ${token} is outside the safe integer range`);
    }
    return Number(integer);
  }

  function parseArray() {
    position += 1;
    const result = [];
    skipWhitespace();
    if (text[position] === "]") {
      position += 1;
      return result;
    }
    while (position < text.length) {
      result.push(parseValue());
      skipWhitespace();
      if (text[position] === "]") {
        position += 1;
        return result;
      }
      if (text[position] !== ",") syntax("expected ',' or ']'");
      position += 1;
      skipWhitespace();
    }
    syntax("unterminated array");
  }

  function parseObject() {
    position += 1;
    const result = Object.create(null);
    const members = new Set();
    skipWhitespace();
    if (text[position] === "}") {
      position += 1;
      return result;
    }
    while (position < text.length) {
      const key = parseString("object member name");
      if (members.has(key)) {
        fail("DUPLICATE_PROPERTY", `duplicate object member ${JSON.stringify(key)}`);
      }
      members.add(key);
      skipWhitespace();
      if (text[position] !== ":") syntax("expected ':'");
      position += 1;
      const value = parseValue();
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      skipWhitespace();
      if (text[position] === "}") {
        position += 1;
        return result;
      }
      if (text[position] !== ",") syntax("expected ',' or '}'");
      position += 1;
      skipWhitespace();
    }
    syntax("unterminated object");
  }

  function parseValue() {
    skipWhitespace();
    const character = text[position];
    if (character === '"') return parseString("string value");
    if (character === "{") return parseObject();
    if (character === "[") return parseArray();
    if (character === "-" || (character >= "0" && character <= "9")) return parseNumber();
    if (text.startsWith("true", position)) {
      position += 4;
      return true;
    }
    if (text.startsWith("false", position)) {
      position += 5;
      return false;
    }
    if (text.startsWith("null", position)) {
      position += 4;
      return null;
    }
    syntax("unexpected token");
  }

  if (typeof text !== "string") fail("TYPE_UNSUPPORTED", "raw JSON must be a string");
  const result = parseValue();
  skipWhitespace();
  if (position !== text.length) syntax("trailing content");
  return result;
}

// RFC 8785 sorts object names by their raw UTF-16 code units. JavaScript's
// relational string comparison has that ordering; it notably differs from
// Unicode scalar-value order for supplementary characters versus U+E000..FFFF.
function compareUtf16(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalize(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") {
    assertUnicodeScalars(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("NON_FINITE_NUMBER", "number is not finite");
    if (Object.is(value, -0)) fail("NEGATIVE_ZERO", "negative zero is forbidden");
    if (!Number.isInteger(value)) fail("FLOAT_FORBIDDEN", "floating-point values are forbidden");
    if (!Number.isSafeInteger(value)) fail("UNSAFE_INTEGER", "unsafe integer is forbidden");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.keys(value)
      .sort(compareUtf16)
      .map((key) => {
        assertUnicodeScalars(key, "object member name");
        return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
      });
    return `{${entries.join(",")}}`;
  }
  fail("TYPE_UNSUPPORTED", `unsupported value type ${typeof value}`);
}

function withoutTopLevelFields(value, fields = []) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    fail("HASH_INPUT_NOT_OBJECT", "domain-separated contract hashes require a root object");
  }
  const omitted = new Set(fields);
  const result = Object.create(null);
  for (const key of Object.keys(value)) {
    if (!omitted.has(key)) result[key] = value[key];
  }
  return result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashVector(profile, parsed) {
  const object = withoutTopLevelFields(parsed, profile.omit_top_level_fields);
  const canonical = canonicalize(object);
  const prefix = [
    "ArcForge",
    profile.canonicalization_version,
    profile.object_type,
    profile.schema_version,
  ].map((part) => Buffer.from(String(part), "utf8"));
  const preimage = Buffer.concat([
    prefix[0],
    Buffer.from([0]),
    prefix[1],
    Buffer.from([0]),
    prefix[2],
    Buffer.from([0]),
    prefix[3],
    Buffer.from([0]),
    Buffer.from(canonical, "utf8"),
  ]);
  return {
    canonical,
    preimage_hex: preimage.toString("hex"),
    sha256: sha256(preimage),
  };
}

function decodePointerToken(token) {
  return token.replace(/~1/gu, "/").replace(/~0/gu, "~");
}

function pointerGet(root, pointer) {
  if (pointer === "") return root;
  if (!pointer.startsWith("/")) fail("INVALID_POINTER", `invalid JSON pointer ${pointer}`);
  let current = root;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = decodePointerToken(rawToken);
    if (current === null || typeof current !== "object" || !(token in current)) {
      fail("INVALID_POINTER", `JSON pointer ${pointer} does not exist`);
    }
    current = current[token];
  }
  return current;
}

function pointerSet(root, pointer, value) {
  const tokens = pointer.slice(1).split("/").map(decodePointerToken);
  if (!pointer.startsWith("/") || tokens.length === 0) {
    fail("INVALID_POINTER", `invalid mutation pointer ${pointer}`);
  }
  let current = root;
  for (const token of tokens.slice(0, -1)) {
    if (current === null || typeof current !== "object" || !(token in current)) {
      fail("INVALID_POINTER", `mutation pointer ${pointer} does not exist`);
    }
    current = current[token];
  }
  const last = tokens.at(-1);
  if (current === null || typeof current !== "object" || !(last in current)) {
    fail("INVALID_POINTER", `mutation pointer ${pointer} does not exist`);
  }
  current[last] = value;
}

function decodeBase64UrlNoPadding(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/u.test(value)) {
    fail("INVALID_BASE64URL", "binary input must be unpadded base64url");
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) {
    fail("INVALID_BASE64URL", "base64url input is not canonical");
  }
  return bytes;
}

function validateAssertions(parsed, assertions = {}, results = new Map()) {
  for (const pointer of assertions.decimal_u64_pointers ?? []) {
    const value = pointerGet(parsed, pointer);
    if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
      fail("INVALID_U64_DECIMAL", `${pointer} must be an unsigned decimal string without leading zeroes`);
    }
    if (BigInt(value) > 18446744073709551615n) {
      fail("U64_OVERFLOW", `${pointer} exceeds uint64`);
    }
  }
  for (const binding of assertions.byte_hashes ?? []) {
    const bytes = decodeBase64UrlNoPadding(binding.source_base64url);
    const expected = pointerGet(parsed, binding.sha256_pointer);
    if (expected !== `sha256:${sha256(bytes)}`) {
      fail("BYTE_HASH_MISMATCH", `${binding.sha256_pointer} does not bind the exact source bytes`);
    }
  }
  if (assertions.bound_invocation_vector) {
    const source = results.get(assertions.bound_invocation_vector);
    if (!source) fail("MISSING_VECTOR_DEPENDENCY", assertions.bound_invocation_vector);
    if (pointerGet(parsed, "/invocation_spec_hash") !== `sha256:${source.sha256}`) {
      fail("INVOCATION_HASH_BINDING_MISMATCH", "Preview does not bind the named InvocationSpec hash");
    }
  }
  if (assertions.trusted_renderer) {
    const renderer = pointerGet(parsed, "/trusted_renderer");
    if (
      renderer.renderer_id !== assertions.trusted_renderer.renderer_id ||
      renderer.renderer_version !== assertions.trusted_renderer.renderer_version ||
      renderer.renderer_binary_hash !== assertions.trusted_renderer.renderer_binary_hash
    ) {
      fail("RENDERER_BINDING_MISMATCH", "Preview does not bind the trusted renderer identity and version");
    }
  }
}

function cloneCanonical(value) {
  return strictParseJson(canonicalize(value));
}

function same(actual, expected, label) {
  if (actual !== expected) {
    fail("GOLDEN_MISMATCH", `${label}: expected ${expected}, got ${actual}`);
  }
}

function loadJsonFile(path) {
  return strictParseJson(decodeUtf8Strict(readFileSync(path), path));
}

function validateRegistry(registry) {
  same(registry.registry_version, "0", "hash registry version");
  same(registry.canonicalization_version, CANONICALIZATION_VERSION, "hash registry canonicalization version");
  same(registry.hash_format, "sha256:<64 lowercase hexadecimal characters>", "hash registry field format");
  const requiredEntries = [
    "ToolIntent",
    "DataBoundaryGrant",
    "ResourceIdentity",
    "InvocationSpec",
    "PolicyDecision",
    "Approval",
    "AuthorizationGrant",
    "EffectReceipt",
    "PreviewBinding",
    "ResourceOperationSet",
    "CommandPayloadRef",
  ];
  const observedEntries = Object.keys(registry.entries).sort().join(",");
  same(observedEntries, [...requiredEntries].sort().join(","), "closed hash registry entry set");
  for (const key of requiredEntries) {
    const entry = registry.entries[key];
    if (!entry) fail("REGISTRY_ENTRY_MISSING", key);
    same(entry.schema_version, "0", `${key} registry schema version`);
    if (entry.kind === "derived_hash") {
      same(entry.kind, "derived_hash", `${key} registry kind`);
      if (!Array.isArray(entry.omit_top_level_fields) || entry.omit_top_level_fields.length !== 0) {
        fail("REGISTRY_INVALID", `${key} must not exclude fields from its derived input`);
      }
      if (typeof entry.output_hash_field !== "string" || entry.output_hash_field.length === 0) {
        fail("REGISTRY_INVALID", `${key} must declare an output hash field`);
      }
      continue;
    }
    same(entry.kind, "self_hash", `${key} registry kind`);
    if (!Array.isArray(entry.omit_top_level_fields) || entry.omit_top_level_fields.length !== 1) {
      fail("REGISTRY_INVALID", `${key} must exclude exactly one self-hash field`);
    }
    same(entry.omit_top_level_fields[0], entry.self_hash_field, `${key} self-hash exclusion`);
  }
  if (Object.hasOwn(registry.entries, "CommandEnvelope")) {
    fail("REGISTRY_INVALID", "CommandEnvelope.payload_hash is not an envelope self-hash");
  }
}

function resolveHashProfile(vector, registry) {
  for (const field of VECTOR_PROFILE_OVERRIDE_FIELDS) {
    if (Object.hasOwn(vector, field)) {
      fail("VECTOR_PROFILE_OVERRIDE", `${vector.id} attempts to override registry-controlled ${field}`);
    }
  }
  const hasRegistryKey = Object.hasOwn(vector, "registry_key");
  const hasProbeProfile = Object.hasOwn(vector, "probe_profile");
  if (hasRegistryKey === hasProbeProfile) {
    fail("VECTOR_PROFILE_AMBIGUOUS", `${vector.id} must select exactly one registry or fixed probe profile`);
  }
  if (hasProbeProfile) {
    const profile = PROBE_PROFILES[vector.probe_profile];
    if (!profile) fail("UNKNOWN_PROBE_PROFILE", vector.probe_profile);
    return profile;
  }
  const entry = registry.entries[vector.registry_key];
  if (!entry) fail("UNKNOWN_REGISTRY_KEY", vector.registry_key);
  if (entry.kind !== "self_hash" && vector.derived_input !== true) {
    fail("INVALID_VECTOR_REGISTRY_KIND", `${vector.id} cannot hash a derived registry entry directly`);
  }
  return {
    canonicalization_version: registry.canonicalization_version,
    object_type: entry.domain_object_type,
    schema_version: entry.schema_version,
    omit_top_level_fields: entry.omit_top_level_fields,
    schema_id: entry.schema_id,
    self_hash_field: entry.self_hash_field,
    output_hash_field: entry.output_hash_field,
    kind: entry.kind,
  };
}

function validateRegistryBinding(parsed, vector, profile) {
  if (!vector.registry_key) return;
  if (profile.kind === "derived_hash") return;
  same(parsed.schema_id, profile.schema_id, `${vector.id} registry schema_id`);
  same(String(parsed.schema_version), profile.schema_version, `${vector.id} registry schema_version`);
  if (Object.hasOwn(parsed, "canonicalization_version")) {
    same(
      parsed.canonicalization_version,
      profile.canonicalization_version,
      `${vector.id} canonicalization_version`,
    );
  }
  const hashValue = parsed[profile.self_hash_field];
  if (typeof hashValue !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(hashValue)) {
    fail("INVALID_HASH_FIELD", `${vector.id}.${profile.self_hash_field} must use tagged lowercase SHA-256`);
  }
}

function prepareVectorHashInput(parsed, vector, profile) {
  if (profile.kind !== "derived_hash") return parsed;
  if (vector.registry_key !== "ResourceOperationSet" || vector.derived_input !== true) {
    fail("INVALID_VECTOR_REGISTRY_KIND", `${vector.id} is not an approved derived-input vector`);
  }
  if (Object.keys(parsed).length !== 1 || !Array.isArray(parsed.resources)) {
    fail("DERIVED_INPUT_INVALID", `${vector.id} must be exactly {resources:[...]}`);
  }
  const prepared = cloneCanonical(parsed);
  prepared.resources.sort((left, right) => compareUtf16(left.resource_operation_id, right.resource_operation_id));
  return prepared;
}

function loadVectorObject(vector, fixtureDirectory) {
  const hasRawInput = Object.hasOwn(vector, "raw_input");
  const hasSourceFile = Object.hasOwn(vector, "source_file");
  if (hasRawInput === hasSourceFile) {
    fail("VECTOR_INPUT_AMBIGUOUS", `${vector.id} must have exactly one of raw_input or source_file`);
  }
  if (hasRawInput) return strictParseJson(vector.raw_input);
  const source = loadJsonFile(resolve(fixtureDirectory, vector.source_file));
  return pointerGet(source, vector.source_pointer ?? "");
}

function rawBytesFromVector(vector) {
  const hasHex = Object.hasOwn(vector, "raw_hex");
  const hasBase64Url = Object.hasOwn(vector, "raw_base64url");
  if (hasHex === hasBase64Url) {
    fail("VECTOR_INPUT_AMBIGUOUS", `${vector.id} must have exactly one raw byte encoding`);
  }
  if (hasHex) {
    if (typeof vector.raw_hex !== "string" || !/^(?:[0-9a-fA-F]{2})*$/u.test(vector.raw_hex)) {
      fail("INVALID_HEX", `${vector.id} raw_hex is not canonical whole bytes`);
    }
    return Buffer.from(vector.raw_hex, "hex");
  }
  return decodeBase64UrlNoPadding(vector.raw_base64url);
}

function profileFromRegistryEntry(registry, registryKey) {
  const entry = registry.entries[registryKey];
  if (!entry) fail("UNKNOWN_REGISTRY_KEY", registryKey);
  return {
    canonicalization_version: registry.canonicalization_version,
    object_type: entry.domain_object_type,
    schema_version: entry.schema_version,
    omit_top_level_fields: entry.omit_top_level_fields,
    schema_id: entry.schema_id,
    self_hash_field: entry.self_hash_field,
    output_hash_field: entry.output_hash_field,
    kind: entry.kind,
  };
}

function validateBundleTopology(configuration, registry) {
  const expectedKeys = Object.keys(EXPECTED_BUNDLE_TOPOLOGY).sort();
  const configuredKeys = configuration.topology.map((check) => check.registry_key);
  same(new Set(configuredKeys).size, configuredKeys.length, "bundle topology registry key uniqueness");
  same([...configuredKeys].sort().join(","), expectedKeys.join(","), "bundle topology closed registry coverage");
  same(Object.keys(registry.entries).sort().join(","), expectedKeys.join(","), "bundle topology registry parity");

  const sourcePointers = new Set();
  const referencePointers = new Set();
  for (const check of configuration.topology) {
    const expected = EXPECTED_BUNDLE_TOPOLOGY[check.registry_key];
    same(check.source_pointer, expected.source_pointer, `${check.registry_key} trusted source pointer`);
    same(check.derivation ?? "", expected.derivation ?? "", `${check.registry_key} trusted derivation`);
    same(
      [...check.reference_pointers].sort().join(","),
      [...expected.reference_pointers].sort().join(","),
      `${check.registry_key} trusted reference pointer coverage`,
    );
    if (sourcePointers.has(check.source_pointer)) {
      fail("BUNDLE_TOPOLOGY_DUPLICATE", `duplicate source pointer ${check.source_pointer}`);
    }
    sourcePointers.add(check.source_pointer);
    for (const pointer of check.reference_pointers) {
      if (referencePointers.has(pointer)) {
        fail("BUNDLE_TOPOLOGY_DUPLICATE", `duplicate reference pointer ${pointer}`);
      }
      referencePointers.add(pointer);
    }
  }
  if ((configuration.command_payload_bindings ?? []).length !== 0) {
    fail("BUNDLE_TOPOLOGY_INVALID", "Command payload hashing is registry-controlled, not an ad hoc binding");
  }
}

function runBundleRegistryChecks(configuration, fixtureDirectory, registry, enforce) {
  validateBundleTopology(configuration, registry);
  const bundlePath = resolve(fixtureDirectory, configuration.source_file);
  const bundle = loadJsonFile(bundlePath);
  const hashes = Object.create(null);
  let checks = 0;

  for (const check of configuration.topology) {
    const profile = profileFromRegistryEntry(registry, check.registry_key);
    let hashInput;
    let targetField;
    if (profile.kind === "derived_hash") {
      const source = cloneCanonical(pointerGet(bundle, check.source_pointer));
      if (check.derivation === "resource_operation_set") {
        if (!Array.isArray(source)) {
          fail("BUNDLE_DERIVATION_INVALID", `${check.registry_key} source is not an array`);
        }
        source.sort((left, right) => compareUtf16(left.resource_operation_id, right.resource_operation_id));
        hashInput = Object.assign(Object.create(null), { resources: source });
      } else if (check.derivation === "identity") {
        hashInput = source;
      } else {
        fail("BUNDLE_DERIVATION_INVALID", `${check.registry_key} has an unknown derivation`);
      }
      targetField = profile.output_hash_field;
    } else {
      hashInput = pointerGet(bundle, check.source_pointer);
      same(hashInput.schema_id, profile.schema_id, `${check.registry_key} bundle schema_id`);
      same(String(hashInput.schema_version), profile.schema_version, `${check.registry_key} bundle schema_version`);
      targetField = profile.self_hash_field;
    }
    const result = hashVector(profile, hashInput);
    const tagged = `sha256:${result.sha256}`;
    hashes[check.registry_key] = tagged;

    if (profile.kind === "self_hash") {
      if (enforce) same(hashInput[targetField], tagged, `${check.registry_key} self hash`);
      else hashInput[targetField] = tagged;
    }
    for (const pointer of check.reference_pointers) {
      if (enforce) same(pointerGet(bundle, pointer), tagged, `${check.registry_key} reference ${pointer}`);
      else pointerSet(bundle, pointer, tagged);
    }
    checks += 1 + check.reference_pointers.length;
  }

  for (const binding of configuration.command_payload_bindings) {
    const payloadHash = pointerGet(bundle, binding.payload_hash_pointer);
    const bodyHash = pointerGet(bundle, binding.payload_body_sha256_pointer);
    same(payloadHash, bodyHash, `${binding.id} payload hash binding`);
    checks += 1;
  }
  return { bundle, hashes, checks };
}

function main() {
  const emit = process.argv.includes("--emit");
  const emitBundleHashes = process.argv.includes("--emit-bundle-hashes");
  const pathArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const fixturePath = resolve(pathArgument ?? DEFAULT_FIXTURE);
  const fixture = loadJsonFile(fixturePath);
  const registry = loadJsonFile(DEFAULT_REGISTRY);
  validateRegistry(registry);
  const fixtureDirectory = dirname(fixturePath);

  if (emitBundleHashes) {
    const derived = runBundleRegistryChecks(fixture.bundle_registry_checks, fixtureDirectory, registry, false);
    process.stdout.write(`${JSON.stringify(derived.hashes, null, 2)}\n`);
    return;
  }
  const results = new Map();
  const emitted = Object.create(null);
  let passed = 0;

  for (const vector of fixture.valid_vectors) {
    const parsed = loadVectorObject(vector, fixtureDirectory);
    const profile = resolveHashProfile(vector, registry);
    validateRegistryBinding(parsed, vector, profile);
    if (!emit) validateAssertions(parsed, vector.assertions, results);
    const hashInput = prepareVectorHashInput(parsed, vector, profile);
    const result = hashVector(profile, hashInput);
    if (!emit && vector.registry_key && profile.kind === "self_hash") {
      same(
        parsed[profile.self_hash_field],
        `sha256:${result.sha256}`,
        `${vector.id} registry self-hash value`,
      );
    }
    results.set(vector.id, { ...result, parsed, vector, profile });
    emitted[vector.id] = {
      expected_canonical: result.canonical,
      expected_preimage_hex: result.preimage_hex,
      expected_sha256: result.sha256,
    };
    if (!emit) {
      same(result.canonical, vector.expected_canonical, `${vector.id} canonical JSON`);
      same(result.preimage_hex, vector.expected_preimage_hex, `${vector.id} preimage`);
      same(result.sha256, vector.expected_sha256, `${vector.id} SHA-256`);
      passed += 1;
    }
  }

  if (emit) {
    process.stdout.write(`${JSON.stringify(emitted, null, 2)}\n`);
    return;
  }

  for (const vector of fixture.invalid_vectors) {
    let observed = null;
    try {
      const parsed = strictParseJson(vector.raw_input);
      validateAssertions(parsed, vector.assertions, results);
      canonicalize(parsed);
    } catch (error) {
      observed = error instanceof VectorError ? error.code : error.constructor.name;
    }
    same(observed, vector.expected_error, `${vector.id} rejection code`);
    passed += 1;
  }


  for (const vector of fixture.invalid_utf8_vectors) {
    let observed = null;
    try {
      const rawBytes = rawBytesFromVector(vector);
      strictParseJson(decodeUtf8Strict(rawBytes, vector.id));
    } catch (error) {
      observed = error instanceof VectorError ? error.code : error.constructor.name;
    }
    same(observed, vector.expected_error, `${vector.id} rejection code`);
    passed += 1;
  }

  for (const assertion of fixture.relationship_assertions) {
    const left = results.get(assertion.left);
    if (!left) fail("MISSING_VECTOR_DEPENDENCY", assertion.left);
    let right;
    if (assertion.right) {
      right = results.get(assertion.right);
      if (!right) fail("MISSING_VECTOR_DEPENDENCY", assertion.right);
    } else {
      const mutated = cloneCanonical(left.parsed);
      pointerSet(mutated, assertion.mutation.pointer, assertion.mutation.value);
      right = hashVector(left.profile, prepareVectorHashInput(mutated, left.vector, left.profile));
    }
    if (assertion.relationship === "same_hash") {
      same(left.sha256, right.sha256, `${assertion.id} same hash`);
      same(left.canonical, right.canonical, `${assertion.id} same canonical JSON`);
    } else if (assertion.relationship === "different_hash") {
      if (left.sha256 === right.sha256) {
        fail("RELATIONSHIP_MISMATCH", `${assertion.id} unexpectedly produced the same hash`);
      }
    } else {
      fail("UNKNOWN_RELATIONSHIP", assertion.relationship);
    }
    passed += 1;
  }

  const bundleChecks = runBundleRegistryChecks(
    fixture.bundle_registry_checks,
    fixtureDirectory,
    registry,
    true,
  );
  passed += bundleChecks.checks;

  process.stdout.write(
    `contract vectors: ${passed} checks passed (${fixture.valid_vectors.length} valid, ` +
      `${fixture.invalid_vectors.length} invalid JSON/profile, ${fixture.invalid_utf8_vectors.length} invalid UTF-8, ` +
      `${fixture.relationship_assertions.length} relationships, ${bundleChecks.checks} bundle registry checks)\n`,
  );
}

try {
  main();
} catch (error) {
  const code = error instanceof VectorError ? error.code : error.constructor.name;
  process.stderr.write(`contract vectors: FAIL [${code}] ${error.message}\n`);
  process.exitCode = 1;
}
