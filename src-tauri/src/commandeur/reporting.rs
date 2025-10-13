use chrono::Utc;

use crate::commandeur::models::{
    CommandeurExecutionLogEntry, CommandeurOperation, CommandeurValidationMessage, ValidationLevel,
};

pub fn push_validation(
    messages: &mut Vec<CommandeurValidationMessage>,
    operation: &CommandeurOperation,
    level: ValidationLevel,
    message: impl Into<String>,
    details: Option<String>,
    folders: Option<Vec<String>>,
) -> CommandeurValidationMessage {
    let entry = CommandeurValidationMessage {
        operation_id: operation.id().to_string(),
        operation_label: Some(operation.label().to_string()),
        level,
        message: message.into(),
        details,
        folders,
    };
    messages.push(entry.clone());
    entry
}

pub fn push_folder_validation(
    messages: &mut Vec<CommandeurValidationMessage>,
    operation: &CommandeurOperation,
    folder: &str,
    level: ValidationLevel,
    message: impl Into<String>,
    details: Option<String>,
) -> CommandeurValidationMessage {
    let entry = CommandeurValidationMessage {
        operation_id: operation.id().to_string(),
        operation_label: Some(operation.label().to_string()),
        level,
        message: message.into(),
        details,
        folders: Some(vec![folder.to_string()]),
    };
    messages.push(entry.clone());
    entry
}

pub fn push_log(
    entries: &mut Vec<CommandeurExecutionLogEntry>,
    operation: &CommandeurOperation,
    level: ValidationLevel,
    message: impl Into<String>,
) -> CommandeurExecutionLogEntry {
    let entry = CommandeurExecutionLogEntry::new(
        operation.id(),
        operation.label(),
        level,
        message,
    );
    entries.push(entry.clone());
    entry
}

pub fn push_log_with_meta(
    entries: &mut Vec<CommandeurExecutionLogEntry>,
    operation_id: &str,
    operation_label: &str,
    level: ValidationLevel,
    message: impl Into<String>,
) -> CommandeurExecutionLogEntry {
    let entry = CommandeurExecutionLogEntry::new(
        operation_id,
        operation_label,
        level,
        message,
    );
    entries.push(entry.clone());
    entry
}

pub fn push_workspace_log(
    entries: &mut Vec<CommandeurExecutionLogEntry>,
    level: ValidationLevel,
    message: impl Into<String>,
) -> CommandeurExecutionLogEntry {
    let entry = CommandeurExecutionLogEntry {
        timestamp: Utc::now().to_rfc3339(),
        operation_id: "__workspace__".into(),
        operation_label: "Workspace".into(),
        message: message.into(),
        level,
    };
    entries.push(entry.clone());
    entry
}
