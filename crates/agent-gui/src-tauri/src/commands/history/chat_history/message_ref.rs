// 稳定消息引用（HistoryMessageRef）的纯 JSON 工具：与前端 chatHistory.ts 的
// contentHash/stableId 算法逐字节对齐，供 history.prefix 与分支会话共用。

pub(crate) fn read_json_trimmed_string(object: &Map<String, Value>, key: &str) -> Option<String> {
    object
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub(crate) fn flatten_user_content(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(blocks)) => blocks
            .iter()
            .filter_map(|block| {
                block.as_object().and_then(|object| {
                    match object.get("type").and_then(Value::as_str) {
                        Some("text") => object.get("text").and_then(Value::as_str),
                        _ => None,
                    }
                })
            })
            .collect::<String>(),
        _ => String::new(),
    }
}

pub(crate) fn append_hash_part(parts: &mut Vec<String>, value: impl AsRef<str>) {
    let value = value.as_ref();
    parts.push(format!("{}:{value}", value.len()));
}

pub(crate) fn fnv1a32(input: &str) -> String {
    let mut hash = 0x811c9dc5_u32;
    for byte in input.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("fnv1a32:{hash:08x}")
}

pub(crate) fn history_message_content_hash(message: &Value) -> String {
    let object = message.as_object();
    let role = object
        .and_then(|object| object.get("role"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    let mut parts = vec!["liveagent-history-ref-v1".to_string()];
    append_hash_part(&mut parts, role);

    if role == "user" {
        let display_text = object
            .and_then(|object| object.get("liveAgentDisplayContent"))
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| {
                flatten_user_content(object.and_then(|object| object.get("content")))
            });
        append_hash_part(&mut parts, display_text);

        let attachments = object
            .and_then(|object| object.get("liveAgentAttachments"))
            .and_then(Value::as_array);
        let valid_attachments = attachments
            .map(|attachments| {
                attachments
                    .iter()
                    .filter_map(Value::as_object)
                    .filter(|attachment| {
                        attachment
                            .get("relativePath")
                            .and_then(Value::as_str)
                            .is_some()
                            && attachment.get("fileName").and_then(Value::as_str).is_some()
                            && attachment.get("kind").and_then(Value::as_str).is_some()
                            && attachment
                                .get("sizeBytes")
                                .and_then(Value::as_f64)
                                .is_some()
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        append_hash_part(&mut parts, valid_attachments.len().to_string());
        for attachment_object in valid_attachments {
            append_hash_part(
                &mut parts,
                attachment_object
                    .get("relativePath")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            );
            append_hash_part(
                &mut parts,
                attachment_object
                    .get("fileName")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            );
            append_hash_part(
                &mut parts,
                attachment_object
                    .get("kind")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            );
            append_hash_part(
                &mut parts,
                attachment_object
                    .get("sizeBytes")
                    .map(Value::to_string)
                    .unwrap_or_else(|| "0".to_string()),
            );
        }
    } else {
        append_hash_part(
            &mut parts,
            object
                .and_then(|object| object.get("content"))
                .map(Value::to_string)
                .unwrap_or_else(|| "null".to_string()),
        );
    }

    fnv1a32(&parts.join("|"))
}

pub(crate) fn history_message_id_for_ref(message: &Value) -> Option<String> {
    let object = message.as_object()?;
    read_json_trimmed_string(object, "id").or_else(|| {
        if object.get("role").and_then(Value::as_str) == Some("assistant") {
            read_json_trimmed_string(object, "responseId")
        } else {
            None
        }
    })
}

pub(crate) fn message_matches_ref(
    message: &Value,
    message_id: &str,
    role: &str,
    content_hash: &str,
) -> bool {
    let Some(object) = message.as_object() else {
        return false;
    };
    let Some(found_message_id) = history_message_id_for_ref(message) else {
        return false;
    };
    let found_role = object
        .get("role")
        .and_then(Value::as_str)
        .unwrap_or_default();
    found_message_id == message_id.trim()
        && found_role == role.trim()
        && history_message_content_hash(message) == content_hash.trim()
}
