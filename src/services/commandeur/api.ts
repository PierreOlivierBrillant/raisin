import { invoke } from "@tauri-apps/api/tauri";
import type {
  CommandeurExecutionResult,
  CommandeurValidationMessage,
  CommandeurWorkflow,
  CommandeurWorkspaceSummary,
  CommandeurSavedWorkflowSummary,
} from "../../types";

function ensureDesktop() {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    throw new Error(
      "Cette fonctionnalité est disponible uniquement sur la version desktop."
    );
  }
}

export async function prepareCommandeurWorkspace(path: string) {
  ensureDesktop();
  return invoke<CommandeurWorkspaceSummary>("commandeur_prepare_workspace", {
    path,
  });
}

export async function validateCommandeurWorkflow(
  workspaceId: string,
  workflow: CommandeurWorkflow
) {
  ensureDesktop();
  return invoke<CommandeurValidationMessage[]>("commandeur_validate_workflow", {
    workspaceId,
    workflow,
  });
}

export async function executeCommandeurWorkflow(
  workspaceId: string,
  workflow: CommandeurWorkflow
) {
  ensureDesktop();
  return invoke<CommandeurExecutionResult>("commandeur_execute_workflow", {
    workspaceId,
    workflow,
  });
}

export async function saveCommandeurWorkflow(
  workflow: CommandeurWorkflow,
  existingId?: string | null
) {
  ensureDesktop();
  return invoke<CommandeurSavedWorkflowSummary>("commandeur_save_workflow", {
    workflow,
    existing_id: existingId ?? null,
  });
}

export async function listSavedCommandeurWorkflows() {
  ensureDesktop();
  return invoke<CommandeurSavedWorkflowSummary[]>(
    "commandeur_list_saved_workflows"
  );
}

export async function loadSavedCommandeurWorkflow(id: string) {
  ensureDesktop();
  return invoke<CommandeurWorkflow>("commandeur_load_saved_workflow", {
    id,
  });
}

export async function deleteSavedCommandeurWorkflow(id: string) {
  ensureDesktop();
  return invoke<void>("commandeur_delete_saved_workflow", { id });
}

export async function duplicateSavedCommandeurWorkflow(id: string) {
  ensureDesktop();
  return invoke<CommandeurSavedWorkflowSummary>(
    "commandeur_duplicate_saved_workflow",
    { id }
  );
}
