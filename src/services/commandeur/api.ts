import { invoke } from "@tauri-apps/api/tauri";
import type {
  CommandeurExecutionResult,
  CommandeurValidationMessage,
  CommandeurWorkflow,
  CommandeurWorkspaceSummary,
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
