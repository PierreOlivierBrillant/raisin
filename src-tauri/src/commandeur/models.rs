use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn default_enabled() -> bool {
    true
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandeurWorkflow {
    pub name: String,
    pub version: Option<String>,
    pub operations: Vec<CommandeurOperation>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OperationMeta {
    pub id: String,
    pub label: String,
    pub comment: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub continue_on_error: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum OperationDetails {
    #[serde(rename_all = "camelCase")]
    CreateFile {
        target: String,
        #[serde(default)]
        overwrite: bool,
        content: String,
    },
    #[serde(rename_all = "camelCase")]
    DeleteFile {
        target: String,
        #[serde(default)]
        required: bool,
    },
    #[serde(rename_all = "camelCase")]
    Copy {
        source: String,
        destination: String,
        #[serde(default)]
        overwrite: bool,
    },
    #[serde(rename_all = "camelCase")]
    Exec {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        shell: ShellKind,
        cwd: Option<String>,
        env: Option<HashMap<String, String>>,
    },
    #[serde(rename_all = "camelCase")]
    ReplaceInFile {
        target: String,
        search: String,
        replace: String,
        mode: ReplaceMode,
        flags: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Rename {
        target: String,
        mode: RenameMode,
        value: String,
        search: Option<String>,
        replace: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Move {
        source: String,
        destination: String,
        #[serde(default)]
        overwrite: bool,
    },
    #[serde(rename_all = "camelCase")]
    Mkdir {
        target: String,
        #[serde(default = "default_true")]
        recursive: bool,
        #[serde(default = "default_true")]
        skip_if_exists: bool,
    },
    #[serde(rename_all = "camelCase")]
    Python {
        inline_script: Option<String>,
        script_path: Option<String>,
        entry: PythonEntry,
    },
    #[serde(rename_all = "camelCase")]
    If {
        test: ConditionTest,
        #[serde(default)]
        then: Vec<CommandeurOperation>,
        #[serde(rename = "else")]
        else_branch: Option<Vec<CommandeurOperation>>,
    },
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ShellKind {
    Default,
    Powershell,
    Bash,
    Zsh,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum ReplaceMode {
    Plain,
    Regex,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum RenameMode {
    Suffix,
    Prefix,
    ChangeExtension,
    Replace,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum PythonEntry {
    Inline,
    File,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ConditionSelector {
    CurrentFolderName,
    FileSearch,
    FileCount,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ConditionOperator {
    Equals,
    Contains,
    Regex,
    Exists,
    #[serde(rename = "not-exists")]
    NotExists,
    #[serde(rename = "greater-than")]
    GreaterThan,
    #[serde(rename = "less-than")]
    LessThan,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ConditionScope {
    CurrentFolder,
    Recursive,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConditionTest {
    pub selector: Option<ConditionSelector>,
    pub operator: Option<ConditionOperator>,
    pub value: Option<String>,
    pub pattern: Option<String>,
    pub scope: Option<ConditionScope>,
    pub exists: Option<String>,
    #[serde(default)]
    pub negate: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandeurOperation {
    #[serde(flatten)]
    pub meta: OperationMeta,
    #[serde(flatten)]
    pub details: OperationDetails,
}

impl CommandeurOperation {
    pub fn id(&self) -> &str {
        &self.meta.id
    }

    pub fn label(&self) -> &str {
        &self.meta.label
    }

    pub fn enabled(&self) -> bool {
        self.meta.enabled
    }

    pub fn continue_on_error(&self) -> bool {
        self.meta.continue_on_error
    }

    pub fn comment(&self) -> Option<&str> {
        self.meta.comment.as_deref()
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandeurValidationMessage {
    pub operation_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_label: Option<String>,
    pub level: ValidationLevel,
    pub message: String,
    pub details: Option<String>,
    pub folders: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum ValidationLevel {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandeurExecutionLogEntry {
    pub timestamp: String,
    pub operation_id: String,
    pub operation_label: String,
    pub message: String,
    pub level: ValidationLevel,
}

impl CommandeurExecutionLogEntry {
    pub fn new(
        operation_id: impl Into<String>,
        operation_label: impl Into<String>,
        level: ValidationLevel,
        message: impl Into<String>,
    ) -> Self {
        Self {
            timestamp: Utc::now().to_rfc3339(),
            operation_id: operation_id.into(),
            operation_label: operation_label.into(),
            message: message.into(),
            level,
        }
    }

    pub fn level_string(&self) -> &'static str {
        match self.level {
            ValidationLevel::Info => "INFO",
            ValidationLevel::Warning => "WARN",
            ValidationLevel::Error => "ERROR",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandeurExecutionResult {
    pub success: bool,
    pub operations_run: usize,
    pub log_file_path: String,
    pub log_entries: Vec<CommandeurExecutionLogEntry>,
    pub warnings: Vec<CommandeurValidationMessage>,
    pub errors: Vec<CommandeurValidationMessage>,
    pub output_archive_path: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedWorkflowSummary {
    pub id: String,
    pub name: String,
    pub saved_at: String,
}
