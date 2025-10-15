mod conditions;
mod errors;
mod execution;
mod execution_control;
mod models;
mod python;
mod reporting;
mod saved_workflows;
mod storage;
mod utils;
mod validation;
mod workspace;

pub use workspace::AppState;

use execution::execute_workflow;
use execution_control::ExecutionStatus;
use models::{
    CommandeurExecutionResult, CommandeurValidationMessage, CommandeurWorkflow,
    SavedWorkflowSummary,
};
use saved_workflows::{
    delete_workflow, duplicate_workflow, list_workflows, load_workflow, save_workflow,
};
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
    let control = state.register_execution().map_err(|err| err.to_string())?;
    let state_clone = state.inner().clone();
    let state_for_execution = state_clone.clone();
    let workflow_clone = workflow.clone();
    let window_clone = window.clone();
    let workspace_id_clone = workspace_id.clone();
    let control_for_execution = control.clone();

    let result = spawn_blocking(move || {
        execute_workflow(
            &state_for_execution,
            Some(&window_clone),
            workspace_id_clone.as_str(),
            &workflow_clone,
            control_for_execution,
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(|err| err.to_string());

    if let Err(err) = state_clone.clear_execution() {
        eprintln!(
            "[commandeur_execute_workflow] unable to clear execution: {}",
            err
        );
    }

    result
}

#[tauri::command]
pub fn commandeur_execution_pause(state: State<AppState>) -> Result<ExecutionStatus, String> {
    state
        .with_execution(|session| {
            session.control.request_pause();
            Ok(session.control.status())
        })
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_execution_resume(state: State<AppState>) -> Result<ExecutionStatus, String> {
    state
        .with_execution(|session| {
            session.control.request_resume();
            Ok(session.control.status())
        })
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn commandeur_execution_stop(state: State<AppState>) -> Result<ExecutionStatus, String> {
    state
        .with_execution(|session| {
            session
                .control
                .request_stop(Some("Arrêt manuel demandé".to_string()));
            Ok(session.control.status())
        })
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
