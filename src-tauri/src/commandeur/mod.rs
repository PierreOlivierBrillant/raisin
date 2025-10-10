mod errors;
mod execution;
mod models;
mod python;
mod saved_workflows;
mod reporting;
mod storage;
mod utils;
mod validation;
mod workspace;

pub use workspace::AppState;

use execution::execute_workflow;
use models::{CommandeurExecutionResult, CommandeurValidationMessage, CommandeurWorkflow, SavedWorkflowSummary};
use saved_workflows::{delete_workflow, duplicate_workflow, list_workflows, load_workflow, save_workflow};
use validation::validate_workflow;
use workspace::{prepare_workspace, CommandeurWorkspaceSummary};

use tauri::{async_runtime::spawn_blocking, State, Window};

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
pub async fn commandeur_execute_workflow(
    window: Window,
    state: State<'_, AppState>,
    workspace_id: String,
    workflow: CommandeurWorkflow,
) -> Result<CommandeurExecutionResult, String> {
    let state_clone = state.inner().clone();
    let workflow_clone = workflow.clone();
    let window_clone = window.clone();

    spawn_blocking(move || {
        execute_workflow(
            &state_clone,
            Some(&window_clone),
            workspace_id.as_str(),
            &workflow_clone,
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_list_saved_workflows() -> Result<Vec<SavedWorkflowSummary>, String> {
    list_workflows().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_save_workflow(
    workflow: CommandeurWorkflow,
    existing_id: Option<String>,
) -> Result<SavedWorkflowSummary, String> {
    save_workflow(&workflow, existing_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_load_saved_workflow(id: String) -> Result<CommandeurWorkflow, String> {
    load_workflow(&id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_delete_saved_workflow(id: String) -> Result<(), String> {
    delete_workflow(&id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_duplicate_saved_workflow(id: String) -> Result<SavedWorkflowSummary, String> {
    duplicate_workflow(&id).map_err(|err| err.to_string())
}
