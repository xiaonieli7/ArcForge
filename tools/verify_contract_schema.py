#!/usr/bin/env python3
"""Verify ArcForge V0 contracts without executing any broker effect.

The verifier intentionally has two rejection layers:

* JSON Schema Draft 2020-12 rejects malformed or open authoritative objects.
* ``validate_semantics`` rejects valid-looking objects whose security bindings do
  not agree across Intent, Spec, Policy, Approval, Authorization, and Receipt.

It also exercises the strict instance JSON loader. Contract numbers must not use
floating point, negative zero, non-finite values, duplicate keys, or integers
outside the IEEE-754 interoperable safe range. Schema metadata is loaded through
a separate duplicate/non-finite rejecting loader because JSON Schema itself may
legitimately contain numeric metadata.
"""

from __future__ import annotations

import argparse
import copy
import ipaddress
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = REPO_ROOT / "contracts" / "v0" / "arcforge-contracts.schema.json"
DEFAULT_VALID = REPO_ROOT / "contracts" / "v0" / "examples" / "valid-contract-bundle.json"
DEFAULT_INVALID = REPO_ROOT / "contracts" / "v0" / "examples" / "invalid-contract-cases.json"
MAX_SAFE_INTEGER = (1 << 53) - 1

CORE_DEFS = {
    "CommandEnvelope",
    "ToolIntent",
    "DataBoundaryGrant",
    "ResourceIdentity",
    "InvocationSpec",
    "PolicyDecision",
    "PreviewBinding",
    "Approval",
    "AuthorizationGrant",
    "ResourceOutcome",
    "EffectReceipt",
}

FORBIDDEN_SECRET_FIELD_NAMES = {
    "rawsecret",
    "secretbytes",
    "secrethandle",
    "secretvalue",
    "plaintextsecret",
    "secretplaintext",
    "secrettoken",
}

UINT64_DECIMAL_FIELDS = {
    "aggregate_version",
    "approval_version",
    "byte_length",
    "capability_provider_version",
    "capability_version",
    "consent_version",
    "expires_monotonic_ticks",
    "expected_size",
    "expected_usn",
    "fencing_token",
    "issued_monotonic_ticks",
    "link_count",
    "max_output_bytes",
    "max_resources",
    "max_uses",
    "policy_snapshot_version",
    "policy_version",
    "provider_profile_version",
    "remaining_uses",
    "requested_deadline_ms",
    "schema_version",
    "source_sequence",
    "source_set_version",
    "source_version",
    "task_spec_version",
    "timeout_ms",
    "trusted_renderer_version",
    "ttl_ms",
    "version",
}
MAX_UINT64 = (1 << 64) - 1


class VerificationFailure(Exception):
    """A stable, human-readable verifier failure."""


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise VerificationFailure(f"duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def _reject_non_finite(token: str) -> None:
    raise VerificationFailure(f"non-finite JSON number is forbidden: {token}")


def _parse_contract_integer(token: str) -> int:
    if token == "-0":
        raise VerificationFailure("negative zero is forbidden in contract JSON")
    value = int(token, 10)
    if abs(value) > MAX_SAFE_INTEGER:
        raise VerificationFailure(
            f"integer outside interoperable safe range: {token}; encode 64-bit values as decimal strings"
        )
    return value


def _reject_contract_float(token: str) -> None:
    raise VerificationFailure(f"floating-point number is forbidden in contract JSON: {token}")


def _validate_unicode_scalar_string(value: str, path: str) -> None:
    index = 0
    while index < len(value):
        code_point = ord(value[index])
        if 0xD800 <= code_point <= 0xDBFF:
            if index + 1 >= len(value) or not 0xDC00 <= ord(value[index + 1]) <= 0xDFFF:
                raise VerificationFailure(f"lone high surrogate is forbidden at {path}")
            index += 2
            continue
        if 0xDC00 <= code_point <= 0xDFFF:
            raise VerificationFailure(f"lone low surrogate is forbidden at {path}")
        index += 1


def _validate_unicode_scalars(value: Any, path: str = "/") -> None:
    if isinstance(value, str):
        _validate_unicode_scalar_string(value, path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _validate_unicode_scalars(child, f"{path.rstrip('/')}/{index}")
    elif isinstance(value, dict):
        for key, child in value.items():
            _validate_unicode_scalar_string(key, f"{path.rstrip('/')}/<key>")
            escaped = key.replace("~", "~0").replace("/", "~1")
            _validate_unicode_scalars(child, f"{path.rstrip('/')}/{escaped}")


def strict_instance_loads(text: str) -> Any:
    """Load authoritative instance JSON using the ArcForge restricted profile."""

    try:
        value = json.loads(
            text,
            object_pairs_hook=_reject_duplicate_keys,
            parse_int=_parse_contract_integer,
            parse_float=_reject_contract_float,
            parse_constant=_reject_non_finite,
        )
        _validate_unicode_scalars(value)
        return value
    except json.JSONDecodeError as exc:
        raise VerificationFailure(f"invalid JSON: {exc}") from exc


def strict_instance_load(path: Path) -> Any:
    return strict_instance_loads(path.read_text(encoding="utf-8"))


def strict_schema_load(path: Path) -> Any:
    """Load schema metadata while allowing legitimate JSON Schema numbers."""

    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_finite,
        )
        _validate_unicode_scalars(value)
        return value
    except json.JSONDecodeError as exc:
        raise VerificationFailure(f"invalid schema JSON: {exc}") from exc


def _normalized_field_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.casefold())


def _walk(value: Any, path: str = "") -> Iterable[tuple[str, Any]]:
    yield path or "/", value
    if isinstance(value, dict):
        for key, child in value.items():
            escaped = key.replace("~", "~0").replace("/", "~1")
            yield from _walk(child, f"{path}/{escaped}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk(child, f"{path}/{index}")


def _forbidden_instance_fields(instance: Any) -> list[str]:
    found: list[str] = []
    for path, value in _walk(instance):
        if not isinstance(value, dict):
            continue
        for key in value:
            if _normalized_field_name(key) in FORBIDDEN_SECRET_FIELD_NAMES:
                found.append(f"{path.rstrip('/')}/{key}")
    return sorted(found)


def verify_schema_structure(schema: dict[str, Any]) -> dict[str, int]:
    """Check invariants that the meta-schema cannot express for this repository."""

    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        raise VerificationFailure(f"schema is not Draft 2020-12 meta-valid: {exc.message}") from exc

    defs = schema.get("$defs")
    if not isinstance(defs, dict):
        raise VerificationFailure("schema is missing an object-valued $defs")
    missing_defs = sorted(CORE_DEFS - set(defs))
    if missing_defs:
        raise VerificationFailure(f"schema is missing core definitions: {', '.join(missing_defs)}")

    object_count = 0
    forbidden_properties: list[str] = []
    for path, node in _walk(schema):
        if not isinstance(node, dict):
            continue
        if node.get("type") == "object":
            object_count += 1
            if node.get("additionalProperties") is not False:
                raise VerificationFailure(
                    f"open object schema at {path}: every type:object must set additionalProperties=false"
                )
        properties = node.get("properties")
        if isinstance(properties, dict):
            for name in properties:
                if _normalized_field_name(name) in FORBIDDEN_SECRET_FIELD_NAMES:
                    forbidden_properties.append(f"{path}/properties/{name}")
    if forbidden_properties:
        raise VerificationFailure(
            "schema exposes forbidden secret fields: " + ", ".join(sorted(forbidden_properties))
        )

    return {"object_schemas": object_count, "core_defs": len(CORE_DEFS)}


def verify_strict_loader() -> int:
    rejected = {
        "duplicate-key": '{"a":1,"a":2}',
        "nan": '{"a":NaN}',
        "positive-infinity": '{"a":Infinity}',
        "negative-infinity": '{"a":-Infinity}',
        "float": '{"a":1.0}',
        "negative-zero": '{"a":-0}',
        "unsafe-integer": '{"a":9007199254740992}',
        "lone-surrogate-value": '{"a":"\\ud800"}',
        "lone-surrogate-key": '{"\\udc00":1}',
    }
    for label, payload in rejected.items():
        try:
            strict_instance_loads(payload)
        except VerificationFailure:
            continue
        raise VerificationFailure(f"strict loader accepted forbidden case: {label}")

    accepted = strict_instance_loads('{"min":-9007199254740991,"max":9007199254740991,"zero":0}')
    if accepted != {"min": -MAX_SAFE_INTEGER, "max": MAX_SAFE_INTEGER, "zero": 0}:
        raise VerificationFailure("strict loader corrupted safe integer boundaries")
    return len(rejected)


def _semantic_error(errors: list[dict[str, str]], code: str, path: str, message: str) -> None:
    item = {"code": code, "path": path, "message": message}
    if item not in errors:
        errors.append(item)


def _index_unique(
    values: list[dict[str, Any]],
    key: str,
    errors: list[dict[str, str]],
    path: str,
    code: str,
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for index, value in enumerate(values):
        identity = value[key]
        if identity in result:
            _semantic_error(errors, code, f"{path}/{index}/{key}", f"duplicate {key}: {identity}")
        else:
            result[identity] = value
    return result


def _compare(
    errors: list[dict[str, str]],
    code: str,
    path: str,
    actual: Any,
    expected: Any,
    label: str,
) -> None:
    if actual != expected:
        _semantic_error(errors, code, path, f"{label} mismatch: {actual!r} != {expected!r}")


def _operation_index(
    values: list[dict[str, Any]],
    errors: list[dict[str, str]],
    path: str,
) -> dict[str, dict[str, Any]]:
    operation_ids = [value["resource_operation_id"] for value in values]
    if operation_ids != sorted(operation_ids):
        _semantic_error(
            errors,
            "E_CANONICAL_ORDER",
            path,
            "resource operations must be physically sorted by resource_operation_id before hashing",
        )
    return _index_unique(values, "resource_operation_id", errors, path, "E_RESOURCE_DUPLICATE")


def _check_data_grant_ref(
    ref: dict[str, Any],
    grants_by_id: dict[str, dict[str, Any]],
    errors: list[dict[str, str]],
    path: str,
) -> dict[str, Any] | None:
    grant = grants_by_id.get(ref["data_boundary_id"])
    if grant is None:
        _semantic_error(
            errors,
            "E_BIND_DATA_GRANT_ID",
            f"{path}/data_boundary_id",
            "DataBoundaryGrant reference does not resolve",
        )
        return None
    _compare(
        errors,
        "E_BIND_DATA_GRANT_VERSION",
        f"{path}/version",
        ref["version"],
        grant["version"],
        "DataBoundaryGrant version",
    )
    _compare(
        errors,
        "E_BIND_DATA_GRANT_HASH",
        f"{path}/grant_hash",
        ref["grant_hash"],
        grant["grant_hash"],
        "DataBoundaryGrant hash",
    )
    return grant


def _expected_aggregate(outcomes: list[str]) -> str:
    if outcomes and all(value == "Applied" for value in outcomes):
        return "Applied"
    if outcomes and all(value == "NotApplied" for value in outcomes):
        return "NotApplied"
    if "Applied" in outcomes:
        return "PartiallyApplied"
    if "StillUnknown" in outcomes:
        return "StillUnknown"
    if "Conflict" in outcomes:
        return "Conflict"
    raise VerificationFailure(f"cannot aggregate empty or unsupported leaf outcomes: {outcomes!r}")


def _is_windows_reserved_segment(segment: str) -> bool:
    trimmed = segment.rstrip(" .")
    if segment in {".", ".."} or trimmed != segment or not trimmed:
        return True
    stem = trimmed.split(".", 1)[0].casefold()
    return stem in {"con", "prn", "aux", "nul", "conin$", "conout$"} or bool(
        re.fullmatch(r"(?:com|lpt)[1-9¹²³]", stem)
    )


def _validate_content_refs(bundle: dict[str, Any], errors: list[dict[str, str]]) -> None:
    for path, node in _walk(bundle):
        if not isinstance(node, dict) or not {"content_ref", "sha256", "byte_length"}.issubset(node):
            continue
        expected_ref = f"arcforge-content:{node['sha256']}"
        _compare(
            errors,
            "E_CONTENT_REF_HASH",
            f"{path.rstrip('/')}/content_ref",
            node["content_ref"],
            expected_ref,
            "ContentRef digest",
        )


def _validate_clock_arithmetic(bundle: dict[str, Any], errors: list[dict[str, str]]) -> None:
    clock_fields = {
        "issued_at_utc_trusted",
        "issued_monotonic_ticks",
        "ttl_ms",
        "expires_monotonic_ticks",
        "clock_epoch_id",
    }
    for path, node in _walk(bundle):
        if not isinstance(node, dict) or not clock_fields.issubset(node):
            continue
        issued = int(node["issued_monotonic_ticks"], 10)
        ttl = int(node["ttl_ms"], 10)
        expires = int(node["expires_monotonic_ticks"], 10)
        if issued + ttl != expires:
            _semantic_error(
                errors,
                "E_LIFETIME_ARITHMETIC",
                f"{path.rstrip('/')}/expires_monotonic_ticks",
                "expires_monotonic_ticks must equal issued_monotonic_ticks + ttl_ms in V0",
            )


def _validate_canonical_origins(bundle: dict[str, Any], errors: list[dict[str, str]]) -> None:
    for path, node in _walk(bundle):
        if not isinstance(node, dict):
            continue
        for field in ("canonical_origin", "canonical_endpoint_origin"):
            origin = node.get(field)
            if not isinstance(origin, str):
                continue
            origin_path = f"{path.rstrip('/')}/{field}"
            try:
                parsed = urlsplit(origin)
                port = parsed.port
            except ValueError:
                _semantic_error(errors, "E_CANONICAL_ENDPOINT", origin_path, "endpoint port or host is invalid")
                continue
            host = parsed.hostname
            invalid = (
                parsed.scheme != "https"
                or host is None
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path != ""
                or parsed.query != ""
                or parsed.fragment != ""
                or origin != origin.casefold()
                or host.endswith(".")
                or host == "localhost"
                or port == 443
                or (port is not None and not 1 <= port <= 65535)
            )
            if host is not None:
                try:
                    host.encode("ascii")
                    ipaddress.ip_address(host)
                except UnicodeEncodeError:
                    invalid = True
                except ValueError:
                    pass
                else:
                    invalid = True
                try:
                    canonical_idna = host.encode("ascii").decode("idna").encode("idna").decode("ascii")
                    if canonical_idna != host:
                        invalid = True
                except (UnicodeError, ValueError):
                    invalid = True
                expected_netloc = host if port is None else f"{host}:{port}"
                if parsed.netloc != expected_netloc:
                    invalid = True
            if invalid:
                _semantic_error(
                    errors,
                    "E_CANONICAL_ENDPOINT",
                    origin_path,
                    "endpoint must be a canonical lowercase HTTPS DNS origin without userinfo, path, query, fragment, IP literal, localhost, trailing dot, or default port",
                )


def _validate_preview_against_spec(
    preview: dict[str, Any],
    spec: dict[str, Any],
    identities_by_id: dict[str, dict[str, Any]],
    errors: list[dict[str, str]],
    preview_path: str,
    spec_path: str,
) -> None:
    _compare(errors, "E_BIND_INVOCATION_ID", f"{preview_path}/invocation_id", preview["invocation_id"], spec["invocation_id"], "Preview invocation ID")
    _compare(errors, "E_BIND_SPEC_HASH", f"{preview_path}/invocation_spec_hash", preview["invocation_spec_hash"], spec["spec_hash"], "Preview InvocationSpec hash")
    _compare(errors, "E_BIND_EFFECT_CLASS", f"{preview_path}/effect_class", preview["effect_class"], spec["effect_class"], "Preview effect class")
    _compare(errors, "E_BIND_RESOURCE_OPERATION", f"{preview_path}/operation", preview["operation"], spec["operation"], "Preview operation")
    _compare(errors, "E_BIND_EXACT_ARGS_HASH", f"{preview_path}/canonical_args_sha256", preview["canonical_args_sha256"], spec["canonical_args"]["sha256"], "Preview canonical argument hash")
    _compare(errors, "E_BIND_EXACT_ARGS_HASH", f"{preview_path}/exact_args_bytes_sha256", preview["exact_args_bytes_sha256"], spec["exact_args_bytes_sha256"], "Preview exact argument bytes hash")
    if "endpoint" in spec:
        _compare(errors, "E_BIND_ENDPOINT_SCOPE", f"{preview_path}/endpoint", preview.get("endpoint"), spec["endpoint"], "Preview endpoint")

    sealed_resources = _operation_index(spec["resources"], errors, f"{spec_path}/resources")
    preview_resources = _operation_index(preview["resources"], errors, f"{preview_path}/resources")
    if set(preview_resources) != set(sealed_resources):
        _semantic_error(errors, "E_RESOURCE_SET", f"{preview_path}/resources", "Preview resource-operation set differs from InvocationSpec")
    for operation_id, sealed in sealed_resources.items():
        shown = preview_resources.get(operation_id)
        if shown is None:
            continue
        _compare(errors, "E_BIND_RESOURCE_ID", f"{preview_path}/resources", shown["resource_identity_id"], sealed["resource_identity_id"], "Preview ResourceIdentity ID")
        _compare(errors, "E_BIND_RESOURCE_REVISION", f"{preview_path}/resources", shown["expected_revision"], sealed["expected_revision"], "Preview expected revision")
        if "expected_content_hash" in sealed:
            _compare(errors, "E_BIND_RESOURCE_CONTENT_HASH", f"{preview_path}/resources", shown.get("proposed_content_hash"), sealed["expected_content_hash"], "Preview proposed content hash")
        identity = identities_by_id.get(sealed["resource_identity_id"])
        if identity is not None:
            _compare(errors, "E_BIND_PREVIEW_LOCATOR", f"{preview_path}/resources", shown["display_locator"], identity["relative_locator"], "Preview display locator")
        operation_tail = sealed["operation"].rsplit(".", 1)[-1].casefold()
        expected_action = {
            "read": "Read",
            "create": "Create",
            "replace": "Replace",
            "write": "Replace",
            "delete": "Delete",
            "send": "Send",
        }.get(operation_tail)
        if expected_action is None:
            _semantic_error(errors, "E_PREVIEW_OPERATION_UNSUPPORTED", f"{preview_path}/resources", "Preview action mapping is undefined for the sealed operation")
        else:
            _compare(errors, "E_BIND_PREVIEW_ACTION", f"{preview_path}/resources", shown["action"], expected_action, "Preview resource action")


def validate_semantics(bundle: dict[str, Any]) -> list[dict[str, str]]:
    """Return stable semantic binding errors for a schema-valid contract bundle."""

    errors: list[dict[str, str]] = []

    commands = bundle["command_envelopes"]
    intents = bundle["tool_intents"]
    grants = bundle["data_boundary_grants"]
    identities = bundle["resource_identities"]
    specs = bundle["invocation_specs"]
    policies = bundle["policy_decisions"]
    previews = bundle["previews"]
    approvals = bundle["approvals"]
    authorizations = bundle["authorization_grants"]
    receipts = bundle["effect_receipts"]

    commands_by_id = _index_unique(commands, "command_id", errors, "/command_envelopes", "E_COMMAND_DUPLICATE")
    intents_by_hash = _index_unique(intents, "intent_hash", errors, "/tool_intents", "E_INTENT_DUPLICATE")
    intents_by_id = _index_unique(intents, "tool_intent_id", errors, "/tool_intents", "E_INTENT_DUPLICATE")
    grants_by_id = _index_unique(
        grants, "data_boundary_id", errors, "/data_boundary_grants", "E_DATA_GRANT_DUPLICATE"
    )
    identities_by_id = _index_unique(
        identities, "resource_identity_id", errors, "/resource_identities", "E_RESOURCE_ID_DUPLICATE"
    )
    specs_by_invocation = _index_unique(
        specs, "invocation_id", errors, "/invocation_specs", "E_INVOCATION_DUPLICATE"
    )
    specs_by_hash = _index_unique(specs, "spec_hash", errors, "/invocation_specs", "E_INVOCATION_DUPLICATE")
    policies_by_id = _index_unique(
        policies, "policy_decision_id", errors, "/policy_decisions", "E_POLICY_DUPLICATE"
    )
    previews_by_id = _index_unique(previews, "preview_id", errors, "/previews", "E_PREVIEW_DUPLICATE")
    approvals_by_id = _index_unique(
        approvals, "approval_id", errors, "/approvals", "E_APPROVAL_DUPLICATE"
    )
    authorizations_by_id = _index_unique(
        authorizations, "authorization_id", errors, "/authorization_grants", "E_AUTHORIZATION_DUPLICATE"
    )

    source_intent_for_spec: dict[str, dict[str, Any]] = {}
    for spec_index, spec in enumerate(specs):
        spec_path = f"/invocation_specs/{spec_index}"
        intent = intents_by_id.get(spec["source_tool_intent_id"])
        if intent is None:
            _semantic_error(
                errors,
                "E_INTENT_NOT_FOUND",
                f"{spec_path}/source_tool_intent_id",
                "InvocationSpec source ToolIntent does not resolve",
            )
            continue
        source_intent_for_spec[spec["invocation_id"]] = intent
        intent_index = intents.index(intent)
        intent_path = f"/tool_intents/{intent_index}"
        _compare(
            errors,
            "E_BIND_INTENT_HASH",
            f"{spec_path}/source_intent_hash",
            spec["source_intent_hash"],
            intent["intent_hash"],
            "InvocationSpec source Intent hash",
        )
        command = commands_by_id.get(intent["causation_command_id"])
        if command is None:
            _semantic_error(
                errors,
                "E_COMMAND_NOT_FOUND",
                f"{intent_path}/causation_command_id",
                "ToolIntent causation CommandEnvelope does not resolve",
            )
        else:
            command_index = commands.index(command)
            command_path = f"/command_envelopes/{command_index}"
            _compare(
                errors,
                "E_BIND_CORRELATION_ID",
                f"{intent_path}/correlation_id",
                intent["correlation_id"],
                command["correlation_id"],
                "Command-to-Intent correlation ID",
            )
            command_scope = command["scope"]
            for field, code in (
                ("workspace_id", "E_BIND_COMMAND_SCOPE"),
                ("task_id", "E_BIND_COMMAND_SCOPE"),
                ("run_id", "E_BIND_COMMAND_SCOPE"),
            ):
                if field in command_scope:
                    _compare(
                        errors,
                        code,
                        f"{command_path}/scope/{field}",
                        command_scope[field],
                        spec[field],
                        f"CommandEnvelope scope {field}",
                    )

        _compare(errors, "E_BIND_WORKSPACE_ID", f"{intent_path}/workspace_id", intent["workspace_id"], spec["workspace_id"], "ToolIntent workspace ID")
        _compare(errors, "E_BIND_TASK_ID", f"{intent_path}/task_id", intent["task_id"], spec["task_id"], "ToolIntent task ID")
        _compare(errors, "E_BIND_RUN_ID", f"{intent_path}/run_id", intent["run_id"], spec["run_id"], "ToolIntent run ID")
        _compare(errors, "E_BIND_RUN_MODE", f"{intent_path}/run_mode", intent["run_mode"], spec["run_mode"], "ToolIntent run mode")
        _compare(errors, "E_BIND_MODE_POLICY_HASH", f"{intent_path}/mode_policy_hash", intent["mode_policy_hash"], spec["mode_policy_hash"], "ToolIntent mode-policy hash")
        _compare(errors, "E_BIND_CAPABILITY", f"{intent_path}/capability_id", intent["capability_id"], spec["capability"]["capability_id"], "ToolIntent capability ID")
        _compare(errors, "E_BIND_RESOURCE_OPERATION", f"{intent_path}/operation", intent["operation"], spec["operation"], "ToolIntent operation")
        _compare(
            errors,
            "E_BIND_ARGS_CONTENT",
            f"{spec_path}/canonical_args",
            spec["canonical_args"],
            intent["declared_arguments"],
            "InvocationSpec canonical arguments and ToolIntent declared arguments",
        )
        if len(spec["resources"]) > int(spec["limits"]["max_resources"], 10):
            _semantic_error(
                errors,
                "E_RESOURCE_LIMIT",
                f"{spec_path}/limits/max_resources",
                "sealed resource count exceeds max_resources",
            )

    for index, identity in enumerate(identities):
        base = f"/resource_identities/{index}"
        if identity["identity_kind"] == "New":
            expected_leaf = identity["relative_locator"].split("/")[-1]
            _compare(
                errors,
                "E_BIND_RESOURCE_LOCATOR",
                f"{base}/leaf_name",
                identity["leaf_name"],
                expected_leaf,
                "new-resource leaf name",
            )
        reserved_segments = [
            segment
            for segment in identity["relative_locator"].split("/")
            if _is_windows_reserved_segment(segment)
        ]
        if reserved_segments:
            _semantic_error(
                errors,
                "E_WINDOWS_RESERVED_NAME",
                f"{base}/relative_locator",
                "relative locator contains a reserved Windows DOS device name",
            )
        if identity["stream_name"] != "" or identity["reparse_chain"]:
            _semantic_error(
                errors,
                "E_UNSAFE_RESOURCE_IDENTITY",
                base,
                "resource identity contains an alternate stream or reparse traversal",
            )
        if identity["identity_kind"] == "Existing" and identity["link_count"] != "1":
            _semantic_error(
                errors,
                "E_UNSAFE_RESOURCE_IDENTITY",
                f"{base}/link_count",
                "hardlinked resources are outside the V0 authorization profile",
            )

    for approval_index, approval in enumerate(approvals):
        approval_path = f"/approvals/{approval_index}"
        decision_record = approval.get("decision_record")
        if approval["status"] == "Approved" and (
            not isinstance(decision_record, dict) or decision_record.get("decision") != "Approved"
        ):
            _semantic_error(
                errors,
                "E_APPROVAL_DECISION_STATE",
                f"{approval_path}/decision_record",
                "Approved status requires an Approved decision record",
            )
        if approval["status"] == "Rejected" and (
            not isinstance(decision_record, dict) or decision_record.get("decision") != "Rejected"
        ):
            _semantic_error(
                errors,
                "E_APPROVAL_DECISION_STATE",
                f"{approval_path}/decision_record",
                "Rejected status requires a Rejected decision record",
            )

    for auth_index, authorization in enumerate(authorizations):
        auth_path = f"/authorization_grants/{auth_index}"
        spec = specs_by_invocation.get(authorization["invocation_id"])
        if spec is None:
            _semantic_error(
                errors,
                "E_INVOCATION_NOT_FOUND",
                f"{auth_path}/invocation_id",
                "AuthorizationGrant invocation_id does not resolve",
            )
            continue

        spec_index = specs.index(spec)
        spec_path = f"/invocation_specs/{spec_index}"
        _compare(errors, "E_BIND_SPEC_HASH", f"{auth_path}/invocation_spec_hash", authorization["invocation_spec_hash"], spec["spec_hash"], "InvocationSpec hash")
        _compare(errors, "E_BIND_EFFECT_ID", f"{auth_path}/effect_id", authorization["effect_id"], spec["effect_id"], "effect ID")
        _compare(errors, "E_BIND_WORKSPACE_ID", f"{auth_path}/workspace_id", authorization["workspace_id"], spec["workspace_id"], "workspace ID")
        _compare(errors, "E_BIND_TASK_ID", f"{auth_path}/task_id", authorization["task_id"], spec["task_id"], "task ID")
        _compare(errors, "E_BIND_RUN_ID", f"{auth_path}/run_id", authorization["run_id"], spec["run_id"], "run ID")
        _compare(errors, "E_BIND_RUN_MODE", f"{auth_path}/run_mode", authorization["run_mode"], spec["run_mode"], "run mode")
        _compare(errors, "E_BIND_MODE_POLICY_HASH", f"{auth_path}/mode_policy_hash", authorization["mode_policy_hash"], spec["mode_policy_hash"], "mode-policy hash")
        _compare(errors, "E_BIND_EFFECT_CLASS", f"{auth_path}/effect_class", authorization["effect_class"], spec["effect_class"], "effect class")
        _compare(errors, "E_BIND_IDEMPOTENCY_KEY", f"{auth_path}/idempotency_key", authorization["idempotency_key"], spec["idempotency_key"], "idempotency key")
        _compare(errors, "E_BIND_CAPABILITY", f"{auth_path}/capability", authorization["capability"], spec["capability"], "capability binding")
        _compare(errors, "E_BIND_SECRET_SCOPE", f"{auth_path}/secret_ref_scope", authorization["secret_ref_scope"], spec["secret_refs"], "secret reference scope")
        _compare(
            errors,
            "E_BIND_EXACT_ARGS_HASH",
            f"{spec_path}/exact_args_bytes_sha256",
            spec["exact_args_bytes_sha256"],
            spec["canonical_args"]["sha256"],
            "canonical argument bytes hash",
        )

        scope = authorization["scope"]
        if scope["scope_type"] == "TaskRun":
            for field, code in (
                ("workspace_id", "E_BIND_SCOPE_WORKSPACE"),
                ("task_id", "E_BIND_SCOPE_TASK"),
                ("run_id", "E_BIND_SCOPE_RUN"),
            ):
                _compare(errors, code, f"{auth_path}/scope/{field}", scope[field], spec[field], f"authorization scope {field}")

        if authorization["status"] == "Active" and authorization["remaining_uses"] != "1":
            _semantic_error(errors, "E_AUTH_USE_STATE", f"{auth_path}/remaining_uses", "Active authorization must have exactly one remaining use")
        if authorization["status"] != "Active" and authorization["remaining_uses"] != "0":
            _semantic_error(errors, "E_AUTH_USE_STATE", f"{auth_path}/remaining_uses", "inactive authorization cannot retain a use")

        if authorization["effect_class"] == "WorkspaceMutation":
            expected_fencing_scope = f"workspace:{authorization['workspace_id']}"
        elif authorization["effect_class"] == "DataEgress":
            grant_ref = authorization.get("data_boundary_grant", spec.get("data_boundary_grant"))
            grant_for_fence = (
                grants_by_id.get(grant_ref["data_boundary_id"])
                if isinstance(grant_ref, dict)
                else None
            )
            if grant_for_fence is None:
                expected_fencing_scope = authorization["fencing_scope"]
                _semantic_error(
                    errors,
                    "E_BIND_DATA_GRANT_ID",
                    f"{auth_path}/data_boundary_grant",
                    "DataEgress fencing scope cannot resolve its DataBoundaryGrant",
                )
            else:
                expected_fencing_scope = (
                    f"task:{authorization['task_id']}:provider:{grant_for_fence['provider_profile_id']}"
                )
        else:
            expected_fencing_scope = authorization["fencing_scope"]
        _compare(errors, "E_BIND_FENCING_SCOPE", f"{auth_path}/fencing_scope", authorization["fencing_scope"], expected_fencing_scope, "fencing scope")

        policy = policies_by_id.get(authorization["policy_decision_id"])
        if policy is None:
            _semantic_error(errors, "E_POLICY_NOT_FOUND", f"{auth_path}/policy_decision_id", "PolicyDecision reference does not resolve")
        else:
            policy_index = policies.index(policy)
            policy_path = f"/policy_decisions/{policy_index}"
            _compare(errors, "E_BIND_POLICY_DECISION_HASH", f"{auth_path}/policy_decision_hash", authorization["policy_decision_hash"], policy["policy_decision_hash"], "PolicyDecision hash")
            _compare(errors, "E_BIND_SPEC_HASH", f"{policy_path}/invocation_spec_hash", policy["invocation_spec_hash"], spec["spec_hash"], "PolicyDecision InvocationSpec hash")
            _compare(errors, "E_BIND_EFFECT_CLASS", f"{policy_path}/effect_class", policy["effect_class"], spec["effect_class"], "PolicyDecision effect class")
            _compare(errors, "E_BIND_PREVIEW_ID", f"{auth_path}/preview_id", authorization["preview_id"], policy["preview_id"], "Authorization Policy preview ID")
            _compare(errors, "E_BIND_PREVIEW_HASH", f"{auth_path}/preview_hash", authorization["preview_hash"], policy["preview_hash"], "Authorization Policy preview hash")
            _compare(errors, "E_BIND_RENDERER", f"{auth_path}/trusted_renderer", authorization["trusted_renderer"], policy["trusted_renderer"], "Authorization Policy renderer")
            policy_preview = previews_by_id.get(policy["preview_id"])
            if policy_preview is None:
                _semantic_error(
                    errors,
                    "E_PREVIEW_NOT_FOUND",
                    f"{policy_path}/preview_id",
                    "PolicyDecision PreviewBinding reference does not resolve",
                )
            else:
                policy_preview_path = f"/previews/{previews.index(policy_preview)}"
                _compare(errors, "E_BIND_PREVIEW_HASH", f"{policy_path}/preview_hash", policy["preview_hash"], policy_preview["preview_hash"], "PolicyDecision Preview hash")
                _compare(errors, "E_BIND_RENDERER", f"{policy_path}/trusted_renderer", policy["trusted_renderer"], policy_preview["trusted_renderer"], "PolicyDecision trusted renderer")
                _compare(errors, "E_BIND_RISK_LEVEL", f"{policy_preview_path}/risk_level", policy_preview["risk_level"], policy["risk_level"], "Preview Policy risk level")
                _validate_preview_against_spec(
                    policy_preview,
                    spec,
                    identities_by_id,
                    errors,
                    policy_preview_path,
                    spec_path,
                )
            policy_preview_constraints = [
                item["binding_hash"]
                for item in policy["required_constraints"]
                if item["constraint_type"] == "Preview"
            ]
            if policy_preview_constraints != [policy["preview_hash"]]:
                _semantic_error(
                    errors,
                    "E_BIND_PREVIEW_HASH",
                    f"{policy_path}/required_constraints",
                    "PolicyDecision must contain exactly one Preview constraint matching preview_hash",
                )
            if policy["decision"] == "Deny":
                _semantic_error(
                    errors,
                    "E_POLICY_DENY_AUTHORIZATION",
                    f"{policy_path}/decision",
                    "a Deny PolicyDecision can never produce an AuthorizationGrant",
                )
            expected_policy_decision = (
                "Allow" if authorization["authorization_basis"] == "PolicyAllow" else "RequireApproval"
            )
            _compare(
                errors,
                "E_POLICY_AUTHORIZATION_MISMATCH",
                f"{policy_path}/decision",
                policy["decision"],
                expected_policy_decision,
                "policy decision for authorization basis",
            )

        approval: dict[str, Any] | None = None
        intent: dict[str, Any] | None = source_intent_for_spec.get(spec["invocation_id"])
        if authorization["authorization_basis"] == "ApprovedByUser":
            approval = approvals_by_id.get(authorization["approval_id"])
            if approval is None:
                _semantic_error(errors, "E_APPROVAL_NOT_FOUND", f"{auth_path}/approval_id", "Approval reference does not resolve")
            else:
                approval_index = approvals.index(approval)
                approval_path = f"/approvals/{approval_index}"
                _compare(errors, "E_BIND_APPROVAL_HASH", f"{auth_path}/approval_hash", authorization["approval_hash"], approval["approval_hash"], "Approval hash")
                _compare(errors, "E_BIND_EFFECT_ID", f"{approval_path}/effect_id", approval["effect_id"], spec["effect_id"], "Approval effect ID")
                _compare(errors, "E_BIND_SPEC_HASH", f"{approval_path}/invocation_spec_hash", approval["invocation_spec_hash"], spec["spec_hash"], "Approval InvocationSpec hash")
                if policy is not None:
                    _compare(errors, "E_BIND_POLICY_ID", f"{approval_path}/policy_decision_id", approval["policy_decision_id"], policy["policy_decision_id"], "Approval PolicyDecision ID")
                    _compare(errors, "E_BIND_POLICY_VERSION", f"{approval_path}/policy_version", approval["policy_version"], policy["policy_version"], "Approval policy version")
                    _compare(errors, "E_BIND_POLICY_HASH", f"{approval_path}/policy_hash", approval["policy_hash"], policy["policy_hash"], "Approval policy hash")
                    _compare(errors, "E_BIND_RISK_LEVEL", f"{approval_path}/risk_level", approval["risk_level"], policy["risk_level"], "Approval risk level")
                    _compare(errors, "E_BIND_PREVIEW_ID", f"{approval_path}/preview_id", approval["preview_id"], policy["preview_id"], "Approval Policy preview ID")
                    _compare(errors, "E_BIND_PREVIEW_HASH", f"{approval_path}/preview_hash", approval["preview_hash"], policy["preview_hash"], "Approval Policy preview hash")
                    _compare(errors, "E_BIND_RENDERER", f"{approval_path}/trusted_renderer", approval["trusted_renderer"], policy["trusted_renderer"], "Approval Policy renderer")
                    preview_bindings = [
                        item["binding_hash"]
                        for item in policy["required_constraints"]
                        if item["constraint_type"] == "Preview"
                    ]
                    if preview_bindings != [approval["preview_hash"]]:
                        _semantic_error(errors, "E_BIND_PREVIEW_HASH", f"{approval_path}/preview_hash", "Approval preview hash must equal the single Policy Preview constraint")

                preview = previews_by_id.get(approval["preview_id"])
                if preview is None:
                    _semantic_error(
                        errors,
                        "E_PREVIEW_NOT_FOUND",
                        f"{approval_path}/preview_id",
                        "Approval PreviewBinding reference does not resolve",
                    )
                else:
                    preview_index = previews.index(preview)
                    preview_path = f"/previews/{preview_index}"
                    _compare(errors, "E_BIND_PREVIEW_HASH", f"{approval_path}/preview_hash", approval["preview_hash"], preview["preview_hash"], "Approval Preview hash")
                    _compare(errors, "E_BIND_RENDERER", f"{approval_path}/trusted_renderer", approval["trusted_renderer"], preview["trusted_renderer"], "trusted renderer binding")
                    _compare(errors, "E_BIND_INVOCATION_ID", f"{preview_path}/invocation_id", preview["invocation_id"], spec["invocation_id"], "Preview invocation ID")
                    _compare(errors, "E_BIND_SPEC_HASH", f"{preview_path}/invocation_spec_hash", preview["invocation_spec_hash"], spec["spec_hash"], "Preview InvocationSpec hash")
                    _compare(errors, "E_BIND_EFFECT_CLASS", f"{preview_path}/effect_class", preview["effect_class"], spec["effect_class"], "Preview effect class")
                    _compare(errors, "E_BIND_RESOURCE_OPERATION", f"{preview_path}/operation", preview["operation"], spec["operation"], "Preview operation")
                    _compare(errors, "E_BIND_EXACT_ARGS_HASH", f"{preview_path}/canonical_args_sha256", preview["canonical_args_sha256"], spec["canonical_args"]["sha256"], "Preview canonical argument hash")
                    _compare(errors, "E_BIND_EXACT_ARGS_HASH", f"{preview_path}/exact_args_bytes_sha256", preview["exact_args_bytes_sha256"], spec["exact_args_bytes_sha256"], "Preview exact argument bytes hash")
                    _compare(errors, "E_BIND_RISK_LEVEL", f"{preview_path}/risk_level", preview["risk_level"], approval["risk_level"], "Preview risk level")
                    _compare(errors, "E_BIND_REVERSIBILITY", f"{preview_path}/reversibility", preview["reversibility"], approval["reversibility"], "Preview reversibility")
                    if "endpoint" in spec:
                        _compare(errors, "E_BIND_ENDPOINT_SCOPE", f"{preview_path}/endpoint", preview.get("endpoint"), spec["endpoint"], "Preview endpoint")

                    sealed_preview_resources = _operation_index(spec["resources"], errors, f"{spec_path}/resources")
                    preview_resources = _operation_index(preview["resources"], errors, f"{preview_path}/resources")
                    if set(preview_resources) != set(sealed_preview_resources):
                        _semantic_error(errors, "E_RESOURCE_SET", f"{preview_path}/resources", "Preview resource-operation set differs from InvocationSpec")
                    for operation_id, sealed in sealed_preview_resources.items():
                        shown = preview_resources.get(operation_id)
                        if shown is None:
                            continue
                        _compare(errors, "E_BIND_RESOURCE_ID", f"{preview_path}/resources", shown["resource_identity_id"], sealed["resource_identity_id"], "Preview ResourceIdentity ID")
                        _compare(errors, "E_BIND_RESOURCE_REVISION", f"{preview_path}/resources", shown["expected_revision"], sealed["expected_revision"], "Preview expected revision")
                        if "expected_content_hash" in sealed:
                            _compare(errors, "E_BIND_RESOURCE_CONTENT_HASH", f"{preview_path}/resources", shown.get("proposed_content_hash"), sealed["expected_content_hash"], "Preview proposed content hash")
                        identity = identities_by_id.get(sealed["resource_identity_id"])
                        if identity is not None:
                            _compare(errors, "E_BIND_PREVIEW_LOCATOR", f"{preview_path}/resources", shown["display_locator"], identity["relative_locator"], "Preview display locator")
                        operation_tail = sealed["operation"].rsplit(".", 1)[-1].casefold()
                        expected_action = {
                            "read": "Read",
                            "create": "Create",
                            "replace": "Replace",
                            "write": "Replace",
                            "delete": "Delete",
                            "send": "Send",
                        }.get(operation_tail)
                        if expected_action is None:
                            _semantic_error(errors, "E_PREVIEW_OPERATION_UNSUPPORTED", f"{preview_path}/resources", "Preview action mapping is undefined for the sealed operation")
                        else:
                            _compare(errors, "E_BIND_PREVIEW_ACTION", f"{preview_path}/resources", shown["action"], expected_action, "Preview resource action")

                approval_scope = approval["scope"]
                if approval_scope["scope_type"] == "TaskRun":
                    for field, code in (
                        ("workspace_id", "E_BIND_SCOPE_WORKSPACE"),
                        ("task_id", "E_BIND_SCOPE_TASK"),
                        ("run_id", "E_BIND_SCOPE_RUN"),
                    ):
                        _compare(errors, code, f"{approval_path}/scope/{field}", approval_scope[field], spec[field], f"approval scope {field}")
                if approval["status"] != "Approved":
                    _semantic_error(errors, "E_APPROVAL_NOT_ACTIVE", f"{approval_path}/status", "ApprovedByUser authorization requires an Approved approval")
                decision_record = approval.get("decision_record")
                if not isinstance(decision_record, dict) or decision_record.get("decision") != "Approved":
                    _semantic_error(
                        errors,
                        "E_APPROVAL_DECISION_STATE",
                        f"{approval_path}/decision_record",
                        "Approved approval must carry an Approved decision record",
                    )
                approved_intent = intents_by_hash.get(approval["intent_hash"])
                if approved_intent is None:
                    _semantic_error(errors, "E_INTENT_NOT_FOUND", f"{approval_path}/intent_hash", "Approval intent hash does not resolve")
                elif intent is not None:
                    _compare(
                        errors,
                        "E_BIND_INTENT_HASH",
                        f"{approval_path}/intent_hash",
                        approval["intent_hash"],
                        intent["intent_hash"],
                        "Approval source Intent hash",
                    )

        if intent is not None:
            intent_index = intents.index(intent)
            intent_path = f"/tool_intents/{intent_index}"
            _compare(errors, "E_BIND_WORKSPACE_ID", f"{intent_path}/workspace_id", intent["workspace_id"], spec["workspace_id"], "ToolIntent workspace ID")
            _compare(errors, "E_BIND_TASK_ID", f"{intent_path}/task_id", intent["task_id"], spec["task_id"], "ToolIntent task ID")
            _compare(errors, "E_BIND_RUN_ID", f"{intent_path}/run_id", intent["run_id"], spec["run_id"], "ToolIntent run ID")
            _compare(errors, "E_BIND_RUN_MODE", f"{intent_path}/run_mode", intent["run_mode"], spec["run_mode"], "ToolIntent run mode")
            _compare(errors, "E_BIND_MODE_POLICY_HASH", f"{intent_path}/mode_policy_hash", intent["mode_policy_hash"], spec["mode_policy_hash"], "ToolIntent mode-policy hash")
            _compare(errors, "E_BIND_CAPABILITY", f"{intent_path}/capability_id", intent["capability_id"], spec["capability"]["capability_id"], "ToolIntent capability ID")
            _compare(errors, "E_BIND_RESOURCE_OPERATION", f"{intent_path}/operation", intent["operation"], spec["operation"], "ToolIntent operation")

        grant_refs: list[tuple[str, dict[str, Any]]] = []
        if intent is not None:
            grant_refs.append((f"/tool_intents/{intents.index(intent)}/data_boundary_grant", intent["data_boundary_grant"]))
        if "data_boundary_grant" in spec:
            grant_refs.append((f"{spec_path}/data_boundary_grant", spec["data_boundary_grant"]))
        if "data_boundary_grant" in authorization:
            grant_refs.append((f"{auth_path}/data_boundary_grant", authorization["data_boundary_grant"]))
        resolved_grants: list[dict[str, Any]] = []
        for ref_path, ref in grant_refs:
            resolved = _check_data_grant_ref(ref, grants_by_id, errors, ref_path)
            if resolved is not None:
                resolved_grants.append(resolved)
        if grant_refs:
            first_ref = grant_refs[0][1]
            for ref_path, ref in grant_refs[1:]:
                _compare(errors, "E_BIND_DATA_GRANT_ID", f"{ref_path}/data_boundary_id", ref["data_boundary_id"], first_ref["data_boundary_id"], "DataBoundaryGrant ID")
                _compare(errors, "E_BIND_DATA_GRANT_VERSION", f"{ref_path}/version", ref["version"], first_ref["version"], "DataBoundaryGrant version")
                _compare(errors, "E_BIND_DATA_GRANT_HASH", f"{ref_path}/grant_hash", ref["grant_hash"], first_ref["grant_hash"], "DataBoundaryGrant hash")
        for grant in resolved_grants:
            _compare(errors, "E_BIND_TASK_ID", f"/data_boundary_grants/{grants.index(grant)}/task_id", grant["task_id"], spec["task_id"], "DataBoundaryGrant task ID")
        if authorization["effect_class"] == "DataEgress":
            endpoint = spec["endpoint"]
            endpoint_scope = authorization["endpoint_scope"]
            _compare(
                errors,
                "E_BIND_ENDPOINT_SCOPE",
                f"{auth_path}/endpoint_scope",
                endpoint_scope,
                endpoint,
                "authorized endpoint scope",
            )
            grant_ref = authorization.get("data_boundary_grant", spec.get("data_boundary_grant"))
            grant = grants_by_id.get(grant_ref["data_boundary_id"]) if isinstance(grant_ref, dict) else None
            if grant is not None:
                if grant["status"] != "Active":
                    _semantic_error(
                        errors,
                        "E_DATA_GRANT_NOT_ACTIVE",
                        f"/data_boundary_grants/{grants.index(grant)}/status",
                        "DataEgress authorization requires an Active DataBoundaryGrant",
                    )
                for endpoint_field, grant_field in (
                    ("canonical_origin", "canonical_endpoint_origin"),
                    ("redirect_policy_hash", "redirect_policy_hash"),
                    ("egress_policy_hash", "egress_policy_hash"),
                ):
                    _compare(
                        errors,
                        "E_BIND_ENDPOINT_GRANT",
                        f"{spec_path}/endpoint/{endpoint_field}",
                        endpoint[endpoint_field],
                        grant[grant_field],
                        f"DataBoundaryGrant {endpoint_field}",
                    )

        spec_resources = _operation_index(spec["resources"], errors, f"{spec_path}/resources")
        auth_resources = _operation_index(authorization["resources"], errors, f"{auth_path}/resources")
        if set(auth_resources) != set(spec_resources):
            _semantic_error(errors, "E_RESOURCE_SET", f"{auth_path}/resources", "Authorization resource-operation set differs from InvocationSpec")
        if intent is not None:
            intent_path = f"/tool_intents/{intents.index(intent)}"
            intent_resources = _operation_index(intent["resource_proposals"], errors, f"{intent_path}/resource_proposals")
            if set(intent_resources) != set(spec_resources):
                _semantic_error(errors, "E_RESOURCE_SET", f"{intent_path}/resource_proposals", "ToolIntent resource-operation set differs from InvocationSpec")
        else:
            intent_resources = {}

        for operation_id, sealed in spec_resources.items():
            identity = identities_by_id.get(sealed["resource_identity_id"])
            if identity is None:
                _semantic_error(errors, "E_RESOURCE_ID_NOT_FOUND", f"{spec_path}/resources", f"ResourceIdentity does not resolve for {operation_id}")
            else:
                _compare(errors, "E_BIND_RESOURCE_HASH", f"{spec_path}/resources", sealed["resource_identity_hash"], identity["resource_identity_hash"], "ResourceIdentity hash")
                _compare(errors, "E_BIND_WORKSPACE_ID", f"/resource_identities/{identities.index(identity)}/workspace_id", identity["workspace_id"], spec["workspace_id"], "ResourceIdentity workspace ID")

            proposal = intent_resources.get(operation_id)
            if proposal is not None:
                for proposal_field, sealed_field, code in (
                    ("resource_identity_id", "resource_identity_id", "E_BIND_RESOURCE_ID"),
                    ("resource_identity_hash", "resource_identity_hash", "E_BIND_RESOURCE_HASH"),
                    ("requested_operation", "operation", "E_BIND_RESOURCE_OPERATION"),
                    ("expected_revision", "expected_revision", "E_BIND_RESOURCE_REVISION"),
                ):
                    _compare(errors, code, f"/tool_intents/{intents.index(intent)}/resource_proposals", proposal[proposal_field], sealed[sealed_field], proposal_field)
                if "requested_content_hash" in proposal and "expected_content_hash" in sealed:
                    _compare(errors, "E_BIND_RESOURCE_CONTENT_HASH", f"/tool_intents/{intents.index(intent)}/resource_proposals", proposal["requested_content_hash"], sealed["expected_content_hash"], "requested content hash")

            authorized = auth_resources.get(operation_id)
            if authorized is not None:
                for field, code in (
                    ("resource_identity_id", "E_BIND_RESOURCE_ID"),
                    ("resource_identity_hash", "E_BIND_RESOURCE_HASH"),
                    ("resource_handle_id", "E_BIND_RESOURCE_HANDLE"),
                    ("resource_handle_hash", "E_BIND_RESOURCE_HANDLE"),
                    ("operation", "E_BIND_RESOURCE_OPERATION"),
                    ("expected_revision", "E_BIND_RESOURCE_REVISION"),
                ):
                    _compare(errors, code, f"{auth_path}/resources", authorized[field], sealed[field], field)

        expected_identity_ids = {item["resource_identity_id"] for item in spec_resources.values()}
        if policy is not None:
            evaluated = _index_unique(policy["evaluated_resource_versions"], "resource_identity_id", errors, f"/policy_decisions/{policies.index(policy)}/evaluated_resource_versions", "E_RESOURCE_DUPLICATE")
            if set(evaluated) != expected_identity_ids:
                _semantic_error(errors, "E_RESOURCE_SET", f"/policy_decisions/{policies.index(policy)}/evaluated_resource_versions", "Policy resource set differs from InvocationSpec")
            for sealed in spec_resources.values():
                item = evaluated.get(sealed["resource_identity_id"])
                if item is not None:
                    _compare(errors, "E_BIND_RESOURCE_HASH", "/policy_decisions", item["resource_identity_hash"], sealed["resource_identity_hash"], "policy resource hash")
                    _compare(errors, "E_BIND_RESOURCE_REVISION", "/policy_decisions", item["resource_revision"], sealed["expected_revision"], "policy resource revision")
        if approval is not None:
            approved_resources = _index_unique(approval["resource_versions"], "resource_identity_id", errors, f"/approvals/{approvals.index(approval)}/resource_versions", "E_RESOURCE_DUPLICATE")
            if set(approved_resources) != expected_identity_ids:
                _semantic_error(errors, "E_RESOURCE_SET", f"/approvals/{approvals.index(approval)}/resource_versions", "Approval resource set differs from InvocationSpec")
            for sealed in spec_resources.values():
                item = approved_resources.get(sealed["resource_identity_id"])
                if item is not None:
                    _compare(errors, "E_BIND_RESOURCE_HASH", "/approvals", item["resource_identity_hash"], sealed["resource_identity_hash"], "approval resource hash")
                    _compare(errors, "E_BIND_RESOURCE_REVISION", "/approvals", item["resource_revision"], sealed["expected_revision"], "approval resource revision")

        epochs: list[tuple[str, str]] = [
            (f"{spec_path}/lifetime/clock_epoch_id", spec["lifetime"]["clock_epoch_id"]),
            (f"{auth_path}/lifetime/clock_epoch_id", authorization["lifetime"]["clock_epoch_id"]),
        ]
        if policy is not None:
            epochs.append((f"/policy_decisions/{policies.index(policy)}/lifetime/clock_epoch_id", policy["lifetime"]["clock_epoch_id"]))
        if approval is not None:
            epochs.append((f"/approvals/{approvals.index(approval)}/lifetime/clock_epoch_id", approval["lifetime"]["clock_epoch_id"]))
        for grant in resolved_grants:
            epochs.append((f"/data_boundary_grants/{grants.index(grant)}/lifetime/clock_epoch_id", grant["lifetime"]["clock_epoch_id"]))
        expected_epoch = epochs[0][1]
        for epoch_path, epoch in epochs[1:]:
            _compare(errors, "E_BIND_CLOCK_EPOCH", epoch_path, epoch, expected_epoch, "clock epoch")

    for receipt_index, receipt in enumerate(receipts):
        receipt_path = f"/effect_receipts/{receipt_index}"
        authorization = authorizations_by_id.get(receipt["authorization_id"])
        if authorization is None:
            _semantic_error(errors, "E_AUTHORIZATION_NOT_FOUND", f"{receipt_path}/authorization_id", "Receipt authorization_id does not resolve")
            continue
        auth_path = f"/authorization_grants/{authorizations.index(authorization)}"
        spec = specs_by_invocation.get(authorization["invocation_id"])
        if spec is None:
            continue
        spec_path = f"/invocation_specs/{specs.index(spec)}"

        _compare(errors, "E_BIND_AUTHORIZATION_HASH", f"{receipt_path}/authorization_hash", receipt["authorization_hash"], authorization["authorization_hash"], "Authorization hash")
        _compare(errors, "E_BIND_EFFECT_ID", f"{receipt_path}/effect_id", receipt["effect_id"], authorization["effect_id"], "receipt effect ID")
        _compare(errors, "E_BIND_INVOCATION_ID", f"{receipt_path}/invocation_id", receipt["invocation_id"], authorization["invocation_id"], "receipt invocation ID")
        _compare(errors, "E_BIND_SPEC_HASH", f"{receipt_path}/invocation_spec_hash", receipt["invocation_spec_hash"], authorization["invocation_spec_hash"], "receipt InvocationSpec hash")
        _compare(errors, "E_BIND_IDEMPOTENCY_KEY", f"{receipt_path}/idempotency_key", receipt["idempotency_key"], authorization["idempotency_key"], "receipt idempotency key")
        _compare(
            errors,
            "E_BIND_RESOURCE_SET_HASH",
            f"{receipt_path}/expected_resource_set_hash",
            receipt["expected_resource_set_hash"],
            spec["expected_resource_set_hash"],
            "sealed resource-operation set hash",
        )
        if not receipt["late_observation"]:
            _compare(
                errors,
                "E_BIND_RECEIPT_BROKER_EPOCH",
                f"{receipt_path}/receipt_source/verified_by_broker_epoch_id",
                receipt["receipt_source"]["verified_by_broker_epoch_id"],
                authorization["broker_epoch_id"],
                "same-session receipt verification Broker epoch",
            )
        source = receipt["receipt_source"]
        if authorization["effect_class"] == "WorkspaceMutation":
            _compare(errors, "E_BIND_RECEIPT_SOURCE_TYPE", f"{receipt_path}/receipt_source/source_type", source["source_type"], "WorkspaceBroker", "WorkspaceMutation receipt source type")
            _compare(errors, "E_BIND_RECEIPT_SOURCE_ID", f"{receipt_path}/receipt_source/source_id", source["source_id"], authorization["capability"]["capability_provider_id"], "WorkspaceMutation receipt source ID")
            _compare(errors, "E_BIND_RECEIPT_VERIFICATION", f"{receipt_path}/receipt_source/verification_method", source["verification_method"], "BrokerInternalAttestation", "WorkspaceMutation receipt verification method")
        elif authorization["effect_class"] == "DataEgress":
            grant_ref = authorization.get("data_boundary_grant", spec.get("data_boundary_grant"))
            grant = grants_by_id.get(grant_ref["data_boundary_id"]) if isinstance(grant_ref, dict) else None
            _compare(errors, "E_BIND_RECEIPT_SOURCE_TYPE", f"{receipt_path}/receipt_source/source_type", source["source_type"], "ProviderEgress", "DataEgress receipt source type")
            if grant is not None:
                _compare(errors, "E_BIND_RECEIPT_SOURCE_ID", f"{receipt_path}/receipt_source/source_id", source["source_id"], grant["provider_profile_id"], "DataEgress receipt source ID")

        sealed_resources = _operation_index(spec["resources"], errors, f"{spec_path}/resources")
        outcomes = _operation_index(receipt["resource_outcomes"], errors, f"{receipt_path}/resource_outcomes")
        if set(outcomes) != set(sealed_resources):
            _semantic_error(errors, "E_RESOURCE_SET", f"{receipt_path}/resource_outcomes", "Receipt resource-operation set differs from InvocationSpec")
        for operation_id, sealed in sealed_resources.items():
            outcome = outcomes.get(operation_id)
            if outcome is None:
                continue
            _compare(errors, "E_BIND_RESOURCE_OPERATION", f"{receipt_path}/resource_outcomes", outcome["operation"], sealed["operation"], "receipt resource operation")
            _compare(errors, "E_BIND_RESOURCE_REVISION", f"{receipt_path}/resource_outcomes", outcome["expected_revision"], sealed["expected_revision"], "receipt expected revision")
            before = outcome["resource_identity_before"]
            identity = identities_by_id.get(sealed["resource_identity_id"])
            if identity is not None and identity["identity_kind"] == "Existing":
                _compare(errors, "E_RECEIPT_BEFORE_IDENTITY", f"{receipt_path}/resource_outcomes", before["state"], "Present", "existing-resource before state")
                if before["state"] == "Present":
                    _compare(errors, "E_RECEIPT_BEFORE_IDENTITY", f"{receipt_path}/resource_outcomes", before["ntfs_identity"], identity["target"], "before-state NTFS identity")
                    _compare(errors, "E_BIND_RESOURCE_REVISION", f"{receipt_path}/resource_outcomes", before["revision"], identity["expected_revision"], "before-state resource revision")
                    _compare(errors, "E_RECEIPT_BEFORE_CONTENT", f"{receipt_path}/resource_outcomes", before["content_hash"], identity["expected_content_hash"], "before-state content hash")
                    _compare(errors, "E_RECEIPT_BEFORE_CONTENT", f"{receipt_path}/resource_outcomes", before["byte_length"], identity["expected_size"], "before-state byte length")
            elif identity is not None and identity["identity_kind"] == "New":
                _compare(errors, "E_RECEIPT_BEFORE_IDENTITY", f"{receipt_path}/resource_outcomes", before["state"], "Absent", "new-resource before state")
                if before["state"] == "Absent":
                    _compare(errors, "E_RECEIPT_BEFORE_IDENTITY", f"{receipt_path}/resource_outcomes", before["absence_proof_hash"], identity["absence_proof_hash"], "before-state absence proof")
            if before["state"] == "Present":
                _compare(errors, "E_BIND_RESOURCE_REVISION", f"{receipt_path}/resource_outcomes", before["revision"], sealed["expected_revision"], "before-state resource revision")
            elif before["state"] == "Absent":
                _compare(errors, "E_BIND_RESOURCE_REVISION", f"{receipt_path}/resource_outcomes", before["absence_proof_hash"], sealed["expected_revision"], "before-state absence proof")
            if outcome["outcome"] == "Applied":
                after = outcome["resource_identity_after"]
                if "expected_content_hash" in sealed:
                    _compare(errors, "E_RECEIPT_AFTER_STATE", f"{receipt_path}/resource_outcomes", after["state"], "Present", "content-writing Applied after-state")
                    if after["state"] == "Present":
                        _compare(errors, "E_RECEIPT_CONTENT_HASH", f"{receipt_path}/resource_outcomes", outcome["content_hash_after"], after["content_hash"], "Applied after-state content hash")
                    _compare(errors, "E_RECEIPT_CONTENT_HASH", f"{receipt_path}/resource_outcomes", outcome["content_hash_after"], sealed["expected_content_hash"], "Applied expected content hash")
                elif after["state"] == "Present":
                    _compare(errors, "E_RECEIPT_CONTENT_HASH", f"{receipt_path}/resource_outcomes", outcome["content_hash_after"], after["content_hash"], "Applied after-state content hash")

        aggregate = _expected_aggregate([item["outcome"] for item in receipt["resource_outcomes"]])
        _compare(errors, "E_RECEIPT_AGGREGATE", f"{receipt_path}/observed_outcome", receipt["observed_outcome"], aggregate, "receipt aggregate outcome")
        if receipt["reconciliation_status"] == "AbandonedWithUncertainty":
            _semantic_error(errors, "E_RECEIPT_ABANDONED", f"{receipt_path}/reconciliation_status", "AbandonedWithUncertainty belongs to the immutable Effect terminal; a Receipt may only append evidence and request explicit reconciliation")
        if not receipt["late_observation"] and receipt["reconciliation_status"] in {
            "DuplicateObservation",
            "Contradictory",
            "ReconciledApplied",
            "ReconciledFailed",
            "ManualResolutionRequired",
            "AbandonedWithUncertainty",
        }:
            _semantic_error(
                errors,
                "E_RECEIPT_LATE_STATE",
                f"{receipt_path}/reconciliation_status",
                "late reconciliation status requires late_observation=true",
            )

    forbidden = _forbidden_instance_fields(bundle)
    for path in forbidden:
        _semantic_error(errors, "E_FORBIDDEN_SECRET_FIELD", path, "authoritative contract contains a forbidden secret-bearing field")

    for path, node in _walk(bundle):
        if not isinstance(node, dict):
            continue
        for field, value in node.items():
            if field not in UINT64_DECIMAL_FIELDS or not isinstance(value, str) or not value.isascii() or not value.isdecimal():
                continue
            if int(value, 10) > MAX_UINT64:
                escaped = field.replace("~", "~0").replace("/", "~1")
                _semantic_error(
                    errors,
                    "E_UINT64_RANGE",
                    f"{path.rstrip('/')}/{escaped}",
                    "decimal uint exceeds the unsigned 64-bit upper bound",
                )

    _validate_content_refs(bundle, errors)
    _validate_clock_arithmetic(bundle, errors)
    _validate_canonical_origins(bundle, errors)

    return sorted(errors, key=lambda item: (item["code"], item["path"], item["message"]))


def _decode_pointer_token(token: str) -> str:
    return token.replace("~1", "/").replace("~0", "~")


def apply_json_pointer_mutation(document: Any, mutation: dict[str, Any]) -> Any:
    """Apply one RFC 6901 pointer add/remove/replace mutation to a deep copy."""

    operation = mutation["op"]
    pointer = mutation["path"]
    if operation not in {"add", "remove", "replace"}:
        raise VerificationFailure(f"unsupported mutation operation: {operation!r}")
    if not isinstance(pointer, str) or not pointer.startswith("/"):
        raise VerificationFailure(f"mutation path must be a non-root JSON Pointer: {pointer!r}")

    result = copy.deepcopy(document)
    tokens = [_decode_pointer_token(token) for token in pointer[1:].split("/")]
    parent = result
    for token in tokens[:-1]:
        if isinstance(parent, list):
            if token == "-":
                raise VerificationFailure("'-' is valid only for the final add token")
            parent = parent[int(token)]
        elif isinstance(parent, dict):
            if token not in parent:
                raise VerificationFailure(f"mutation parent path does not exist: {pointer!r}")
            parent = parent[token]
        else:
            raise VerificationFailure(f"mutation traverses a scalar: {pointer!r}")

    leaf = tokens[-1]
    if isinstance(parent, list):
        if operation == "add":
            if leaf == "-":
                parent.append(copy.deepcopy(mutation["value"]))
            else:
                index = int(leaf)
                if index < 0 or index > len(parent):
                    raise VerificationFailure(f"array add index out of range: {pointer!r}")
                parent.insert(index, copy.deepcopy(mutation["value"]))
        else:
            index = int(leaf)
            if index < 0 or index >= len(parent):
                raise VerificationFailure(f"array mutation index out of range: {pointer!r}")
            if operation == "remove":
                del parent[index]
            else:
                parent[index] = copy.deepcopy(mutation["value"])
    elif isinstance(parent, dict):
        if operation in {"remove", "replace"} and leaf not in parent:
            raise VerificationFailure(f"mutation target does not exist: {pointer!r}")
        if operation == "remove":
            del parent[leaf]
        else:
            parent[leaf] = copy.deepcopy(mutation["value"])
    else:
        raise VerificationFailure(f"mutation parent is a scalar: {pointer!r}")
    return result


def _schema_keywords(errors: Iterable[Any]) -> set[str]:
    keywords: set[str] = set()

    def visit(error: Any) -> None:
        if error.validator is not None:
            keywords.add(str(error.validator))
        for child in error.context:
            visit(child)

    for error in errors:
        visit(error)
    return keywords


def verify_negative_cases(
    validator: Draft202012Validator,
    base: dict[str, Any],
    catalog: dict[str, Any],
) -> tuple[int, list[str]]:
    cases = catalog.get("cases")
    if not isinstance(cases, list) or len(cases) < 16:
        raise VerificationFailure("negative-case catalog must contain at least 16 cases")

    seen_ids: set[str] = set()
    failures: list[str] = []
    for case in cases:
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id:
            failures.append("<missing-id>: case id must be a non-empty string")
            continue
        if case_id in seen_ids:
            failures.append(f"{case_id}: duplicate case id")
            continue
        seen_ids.add(case_id)

        try:
            mutations = case.get("mutations")
            if mutations is None:
                mutations = [case["mutation"]]
            if not isinstance(mutations, list) or not mutations:
                raise VerificationFailure("case must define one mutation or a non-empty mutations list")
            mutated = base
            for mutation in mutations:
                mutated = apply_json_pointer_mutation(mutated, mutation)
            schema_errors = list(validator.iter_errors(mutated))
            expected = case["expected"]
            if expected["layer"] == "schema":
                if not schema_errors:
                    failures.append(f"{case_id}: expected schema rejection but schema accepted mutation")
                    continue
                keywords = _schema_keywords(schema_errors)
                if expected["keyword"] not in keywords:
                    failures.append(
                        f"{case_id}: expected schema keyword {expected['keyword']!r}; got {sorted(keywords)!r}"
                    )
            elif expected["layer"] == "semantic":
                if schema_errors:
                    keywords = sorted(_schema_keywords(schema_errors))
                    failures.append(f"{case_id}: expected semantic rejection but schema failed first with {keywords!r}")
                    continue
                semantic_errors = validate_semantics(mutated)
                codes = {item["code"] for item in semantic_errors}
                if expected["code"] not in codes:
                    failures.append(
                        f"{case_id}: expected semantic code {expected['code']!r}; got {sorted(codes)!r}"
                    )
            else:
                failures.append(f"{case_id}: unknown expected layer {expected.get('layer')!r}")
        except (KeyError, TypeError, ValueError, IndexError, VerificationFailure) as exc:
            failures.append(f"{case_id}: invalid test definition: {exc}")
    return len(cases), failures


def verify_semantic_branch_probes(
    validator: Draft202012Validator,
    base: dict[str, Any],
) -> int:
    """Exercise valid alternate branches that the single formal bundle cannot show."""

    def mutated(mutations: list[dict[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = base
        for mutation in mutations:
            value = apply_json_pointer_mutation(value, mutation)
        return value

    def require_valid(name: str, value: dict[str, Any]) -> None:
        schema_errors = list(validator.iter_errors(value))
        if schema_errors:
            raise VerificationFailure(
                f"semantic branch probe {name} failed schema with {sorted(_schema_keywords(schema_errors))!r}"
            )
        errors = validate_semantics(value)
        if errors:
            rendered = ", ".join(sorted({item["code"] for item in errors}))
            raise VerificationFailure(f"semantic branch probe {name} failed with {rendered}")

    policy_allow = mutated(
        [
            {"op": "replace", "path": "/authorization_grants/0/authorization_basis", "value": "PolicyAllow"},
            {"op": "remove", "path": "/authorization_grants/0/approval_id"},
            {"op": "remove", "path": "/authorization_grants/0/approval_hash"},
            {"op": "replace", "path": "/policy_decisions/0/decision", "value": "Allow"},
        ]
    )
    require_valid("PolicyAllow lineage", policy_allow)

    late_epoch = mutated(
        [
            {"op": "replace", "path": "/effect_receipts/0/late_observation", "value": True},
            {
                "op": "replace",
                "path": "/effect_receipts/0/reconciliation_status",
                "value": "DuplicateObservation",
            },
            {
                "op": "replace",
                "path": "/effect_receipts/0/receipt_source/verified_by_broker_epoch_id",
                "value": "018f0f6c-7b11-7a10-8b01-000000000099",
            },
        ]
    )
    require_valid("late receipt verified after Broker restart", late_epoch)

    endpoint = {
        "canonical_origin": base["data_boundary_grants"][0]["canonical_endpoint_origin"],
        "redirect_policy_hash": base["data_boundary_grants"][0]["redirect_policy_hash"],
        "egress_policy_hash": base["data_boundary_grants"][0]["egress_policy_hash"],
    }
    data_egress_mutations = [
        {"op": "replace", "path": "/invocation_specs/0/effect_class", "value": "DataEgress"},
        {"op": "add", "path": "/invocation_specs/0/endpoint", "value": endpoint},
        {"op": "replace", "path": "/policy_decisions/0/effect_class", "value": "DataEgress"},
        {"op": "replace", "path": "/previews/0/effect_class", "value": "DataEgress"},
        {"op": "add", "path": "/previews/0/endpoint", "value": endpoint},
        {"op": "replace", "path": "/authorization_grants/0/effect_class", "value": "DataEgress"},
        {
            "op": "add",
            "path": "/authorization_grants/0/data_boundary_grant",
            "value": base["invocation_specs"][0]["data_boundary_grant"],
        },
        {"op": "add", "path": "/authorization_grants/0/endpoint_scope", "value": endpoint},
        {
            "op": "replace",
            "path": "/authorization_grants/0/fencing_scope",
            "value": (
                f"task:{base['authorization_grants'][0]['task_id']}:provider:"
                f"{base['data_boundary_grants'][0]['provider_profile_id']}"
            ),
        },
        {
            "op": "replace",
            "path": "/effect_receipts/0/receipt_source/source_type",
            "value": "ProviderEgress",
        },
        {
            "op": "replace",
            "path": "/effect_receipts/0/receipt_source/source_id",
            "value": base["data_boundary_grants"][0]["provider_profile_id"],
        },
    ]
    data_egress = mutated(data_egress_mutations)
    require_valid("DataEgress grant, endpoint, and fence", data_egress)

    inactive_grant = apply_json_pointer_mutation(
        data_egress,
        {"op": "replace", "path": "/data_boundary_grants/0/status", "value": "Invalidated"},
    )
    schema_errors = list(validator.iter_errors(inactive_grant))
    if schema_errors:
        raise VerificationFailure("inactive DataBoundaryGrant branch probe unexpectedly failed schema")
    inactive_codes = {item["code"] for item in validate_semantics(inactive_grant)}
    if "E_DATA_GRANT_NOT_ACTIVE" not in inactive_codes:
        raise VerificationFailure(
            f"inactive DataBoundaryGrant branch probe missed E_DATA_GRANT_NOT_ACTIVE: {sorted(inactive_codes)!r}"
        )

    order_errors: list[dict[str, str]] = []
    _operation_index(
        [
            {"resource_operation_id": "operation-b"},
            {"resource_operation_id": "operation-a"},
        ],
        order_errors,
        "/canonical-order-probe",
    )
    if "E_CANONICAL_ORDER" not in {item["code"] for item in order_errors}:
        raise VerificationFailure("canonical resource-operation order probe was not rejected")
    return 5


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--valid", type=Path, default=DEFAULT_VALID)
    parser.add_argument("--invalid", type=Path, default=DEFAULT_INVALID)
    parser.add_argument("--quiet", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    try:
        schema = strict_schema_load(args.schema.resolve())
        structure = verify_schema_structure(schema)
        loader_rejections = verify_strict_loader()

        valid_bundle = strict_instance_load(args.valid.resolve())
        invalid_catalog = strict_instance_load(args.invalid.resolve())
        forbidden = _forbidden_instance_fields(valid_bundle)
        if forbidden:
            raise VerificationFailure("valid fixture contains forbidden secret fields: " + ", ".join(forbidden))

        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        schema_errors = list(validator.iter_errors(valid_bundle))
        if schema_errors:
            first = schema_errors[0]
            path = "/" + "/".join(str(part) for part in first.absolute_path)
            raise VerificationFailure(
                f"valid fixture failed schema at {path or '/'} ({first.validator}): {first.message}"
            )
        semantic_errors = validate_semantics(valid_bundle)
        if semantic_errors:
            rendered = "; ".join(
                f"{item['code']} at {item['path']}: {item['message']}" for item in semantic_errors
            )
            raise VerificationFailure(f"valid fixture failed semantic validation: {rendered}")

        branch_probe_count = verify_semantic_branch_probes(validator, valid_bundle)
        case_count, case_failures = verify_negative_cases(validator, valid_bundle, invalid_catalog)
        if case_failures:
            raise VerificationFailure("negative-case failures:\n  - " + "\n  - ".join(case_failures))

        if not args.quiet:
            print("PASS Draft 2020-12 schema meta-validation")
            print(
                f"PASS closed authoritative schema: {structure['object_schemas']} object schemas, "
                f"{structure['core_defs']} core definitions"
            )
            print(f"PASS strict instance JSON loader: {loader_rejections} forbidden number/key cases rejected")
            print("PASS valid contract bundle: schema and semantic bindings")
            print(f"PASS semantic branch probes: {branch_probe_count}/{branch_probe_count}")
            print(f"PASS invalid contract mutations: {case_count}/{case_count}")
            print(
                "RESIDUAL P1 BC-09: operation-specific descriptors and postconditions are not frozen; "
                "candidate only, not Contract Frozen"
            )
        return 0
    except (OSError, VerificationFailure) as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
