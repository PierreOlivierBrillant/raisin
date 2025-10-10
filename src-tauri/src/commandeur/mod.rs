mod errors;
mod execution;
mod models;
mod python;
mod reporting;
mod utils;
mod validation;
mod workspace;

pub use workspace::AppState;

use execution::execute_workflow;
use models::{CommandeurExecutionResult, CommandeurValidationMessage, CommandeurWorkflow};
use validation::validate_workflow;
use workspace::{prepare_workspace, CommandeurWorkspaceSummary};

use tauri::State;

#[tauri::command]
pub fn commandeur_prepare_workspace(
    state: State<AppState>,
    path: String,
) -> Result<CommandeurWorkspaceSummary, String> {
    prepare_workspace(&state, path.as_str()).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_validate_workflow(
    state: State<AppState>,
    workspace_id: String,
    workflow: CommandeurWorkflow,
) -> Result<Vec<CommandeurValidationMessage>, String> {
    validate_workflow(&state, workspace_id.as_str(), &workflow).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_execute_workflow(
    state: State<AppState>,
    workspace_id: String,
    workflow: CommandeurWorkflow,
) -> Result<CommandeurExecutionResult, String> {
    execute_workflow(&state, workspace_id.as_str(), &workflow).map_err(|err| err.to_string())
}
