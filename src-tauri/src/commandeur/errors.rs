use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommandeurError {
    #[error("Workspace introuvable")]
    WorkspaceNotFound,
    #[error("Operation '{operation_label}' échouée: {source}")]
    OperationFailed {
        operation_id: String,
        operation_label: String,
        continue_on_error: bool,
        #[source]
        source: anyhow::Error,
    },
}
