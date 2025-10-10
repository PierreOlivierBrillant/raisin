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
) {
    messages.push(CommandeurValidationMessage {
        operation_id: operation.id().to_string(),
        level,
        message: message.into(),
        details,
        folders,
    });
}

pub fn push_folder_validation(
    messages: &mut Vec<CommandeurValidationMessage>,
    operation: &CommandeurOperation,
    folder: &str,
    level: ValidationLevel,
    message: impl Into<String>,
    details: Option<String>,
) {
    messages.push(CommandeurValidationMessage {
        operation_id: operation.id().to_string(),
        level,
        message: message.into(),
        details,
        folders: Some(vec![folder.to_string()]),
    });
}

pub fn push_log(
    entries: &mut Vec<CommandeurExecutionLogEntry>,
    operation: &CommandeurOperation,
    level: ValidationLevel,
    message: impl Into<String>,
) {
    entries.push(CommandeurExecutionLogEntry::new(
        operation.id(),
        operation.label(),
        level,
        message,
    ));
}

pub fn push_log_with_meta(
    entries: &mut Vec<CommandeurExecutionLogEntry>,
    operation_id: &str,
    operation_label: &str,
    level: ValidationLevel,
    message: impl Into<String>,
) {
    entries.push(CommandeurExecutionLogEntry::new(
        operation_id,
        operation_label,
        level,
        message,
    ));
}

pub fn push_workspace_log(
    entries: &mut Vec<CommandeurExecutionLogEntry>,
    level: ValidationLevel,
    message: impl Into<String>,
) {
    entries.push(CommandeurExecutionLogEntry {
        timestamp: Utc::now().to_rfc3339(),
        operation_id: "__workspace__".into(),
        operation_label: "Workspace".into(),
        message: message.into(),
        level,
    });
}
