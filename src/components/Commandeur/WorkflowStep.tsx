import React, { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { readTextFile } from "@tauri-apps/api/fs";
import { commandeurStyles } from "./Commandeur.styles";
import type {
  CommandeurSavedWorkflowSummary,
  CommandeurValidationMessage,
  CommandeurWorkflow,
  CommandeurWorkspaceSummary,
} from "../../types";
import {
  parseWorkflowYaml,
  serializeWorkflowToYaml,
} from "../../services/commandeur/workflowYaml";
import WorkflowEditor from "./WorkflowEditor/WorkflowEditor";
import {
  deleteSavedCommandeurWorkflow,
  duplicateSavedCommandeurWorkflow,
  listSavedCommandeurWorkflows,
  loadSavedCommandeurWorkflow,
  saveCommandeurWorkflow,
} from "../../services/commandeur/api";

interface WorkflowStepProps {
  workspace: CommandeurWorkspaceSummary | null;
  workflow: CommandeurWorkflow | null;
  workflowPath: string | null;
  savedWorkflowId: string | null;
  validationMessages: CommandeurValidationMessage[];
  validationStatus: "idle" | "running" | "success" | "warning" | "error";
  isValidating: boolean;
  validationError: string | null;
  onWorkflowLoaded: (payload: {
    workflow: CommandeurWorkflow;
    path: string | null;
    savedId?: string | null;
  }) => void;
  onWorkflowChanged: (workflow: CommandeurWorkflow) => void;
  onReset: () => void;
  onValidate: (options?: { advanceOnSuccess?: boolean }) => Promise<void>;
  onWorkflowSaved: (id: string | null) => void;
  onNotify: (toast: {
    tone: "info" | "success" | "error";
    message: string;
  }) => void;
}

function computeValidationTone(
  status: WorkflowStepProps["validationStatus"],
  messages: CommandeurValidationMessage[]
): "neutral" | "success" | "warning" | "error" {
  if (status === "error") return "error";
  if (status === "running") return "neutral";
  if (messages.some((m) => m.level === "error")) return "error";
  if (messages.some((m) => m.level === "warning")) return "warning";
  if (status === "success") return "success";
  return "neutral";
}

export const WorkflowStep: React.FC<WorkflowStepProps> = ({
  workspace,
  workflow,
  workflowPath,
  savedWorkflowId,
  validationMessages,
  validationStatus,
  isValidating,
  validationError,
  onWorkflowLoaded,
  onWorkflowChanged,
  onReset,
  onValidate,
  onWorkflowSaved,
  onNotify,
}) => {
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<
    CommandeurSavedWorkflowSummary[]
  >([]);
  const [isLoadingSavedWorkflows, setIsLoadingSavedWorkflows] = useState(false);
  const [savedWorkflowsError, setSavedWorkflowsError] = useState<string | null>(
    null
  );
  const [pendingSavedWorkflowId, setPendingSavedWorkflowId] = useState<
    string | null
  >(null);
  const [activeSavedWorkflowId, setActiveSavedWorkflowId] = useState<
    string | null
  >(savedWorkflowId);

  useEffect(() => {
    if (savedWorkflowId) {
      setActiveSavedWorkflowId(savedWorkflowId);
    }
  }, [savedWorkflowId]);

  useEffect(() => {
    if (savedWorkflowId === null && !workflow) {
      setActiveSavedWorkflowId(null);
    }
  }, [savedWorkflowId, workflow]);

  const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;

  const refreshSavedWorkflows = useCallback(async () => {
    if (!isDesktop) return;
    try {
      setIsLoadingSavedWorkflows(true);
      setSavedWorkflowsError(null);
      const list = await listSavedCommandeurWorkflows();
      setSavedWorkflows(list);
    } catch (err) {
      setSavedWorkflowsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingSavedWorkflows(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    refreshSavedWorkflows();
  }, [refreshSavedWorkflows]);

  const loadWorkflowFromFile = async () => {
    try {
      setImportError(null);
      const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;
      if (!isDesktop) {
        throw new Error(
          "L'import YAML est disponible uniquement dans l'application desktop."
        );
      }
      const selection = await open({
        multiple: false,
        filters: [{ name: "Workflow YAML", extensions: ["yaml", "yml"] }],
      });
      if (!selection || Array.isArray(selection)) return;
      const content = await readTextFile(selection);
      const parsed = parseWorkflowYaml(content);
      setActiveSavedWorkflowId(null);
      onWorkflowLoaded({ workflow: parsed, path: selection, savedId: null });
      setSaveError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const createEmptyWorkflow = () => {
    const fresh: CommandeurWorkflow = {
      name: "Workflow Raisin",
      version: "1.0",
      operations: [],
    };
    setActiveSavedWorkflowId(null);
    onWorkflowLoaded({ workflow: fresh, path: null, savedId: null });
    setImportError(null);
    setSaveError(null);
  };

  const handleSaveWorkflow = useCallback(async () => {
    if (!workflow || !isDesktop) return;
    try {
      setIsSavingWorkflow(true);
      setSaveError(null);
      const previousId = activeSavedWorkflowId;
      const summary = await saveCommandeurWorkflow(
        workflow,
        activeSavedWorkflowId
      );
      if (previousId && summary.id !== previousId) {
        try {
          await deleteSavedCommandeurWorkflow(previousId);
        } catch (cleanupError) {
          console.warn(
            "Impossible de supprimer l'ancien workflow sauvegardé",
            cleanupError
          );
        }
      }
      setActiveSavedWorkflowId(summary.id);
      onWorkflowSaved(summary.id);
      await refreshSavedWorkflows();
      onNotify({
        tone: "success",
        message: `Workflow "${summary.name}" enregistré`,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      onNotify({
        tone: "error",
        message:
          err instanceof Error
            ? err.message
            : "Impossible d'enregistrer le workflow",
      });
    } finally {
      setIsSavingWorkflow(false);
    }
  }, [
    isDesktop,
    activeSavedWorkflowId,
    refreshSavedWorkflows,
    workflow,
    onWorkflowSaved,
    onNotify,
  ]);

  const handleLoadSavedWorkflow = useCallback(
    async (entry: CommandeurSavedWorkflowSummary) => {
      if (!isDesktop) return;
      try {
        const loaded = await loadSavedCommandeurWorkflow(entry.id);
        setActiveSavedWorkflowId(entry.id);
        onWorkflowLoaded({ workflow: loaded, path: null, savedId: entry.id });
        setImportError(null);
        setSaveError(null);
        onNotify({
          tone: "info",
          message: `Workflow "${entry.name}" chargé`,
        });
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
        onNotify({
          tone: "error",
          message:
            err instanceof Error
              ? err.message
              : "Impossible de charger le workflow",
        });
      }
    },
    [isDesktop, onWorkflowLoaded, onNotify]
  );

  const handleDeleteSavedWorkflow = useCallback(
    async (entry: CommandeurSavedWorkflowSummary) => {
      if (!isDesktop) return;
      const confirmed = window.confirm(
        `Supprimer le workflow "${entry.name}" ?`
      );
      if (!confirmed) return;
      try {
        setPendingSavedWorkflowId(entry.id);
        await deleteSavedCommandeurWorkflow(entry.id);
        if (entry.id === savedWorkflowId) {
          onWorkflowSaved(null);
        }
        if (entry.id === activeSavedWorkflowId) {
          setActiveSavedWorkflowId(null);
        }
        await refreshSavedWorkflows();
        onNotify({
          tone: "success",
          message: `Workflow "${entry.name}" supprimé`,
        });
      } catch (err) {
        onNotify({
          tone: "error",
          message:
            err instanceof Error
              ? err.message
              : "Impossible de supprimer le workflow",
        });
      } finally {
        setPendingSavedWorkflowId(null);
      }
    },
    [
      activeSavedWorkflowId,
      isDesktop,
      onNotify,
      refreshSavedWorkflows,
      savedWorkflowId,
      onWorkflowSaved,
    ]
  );

  const handleDuplicateSavedWorkflow = useCallback(
    async (entry: CommandeurSavedWorkflowSummary) => {
      if (!isDesktop) return;
      try {
        setPendingSavedWorkflowId(entry.id);
        const summary = await duplicateSavedCommandeurWorkflow(entry.id);
        await refreshSavedWorkflows();
        onNotify({
          tone: "success",
          message: `Workflow "${entry.name}" dupliqué`,
        });
        const duplicated = await loadSavedCommandeurWorkflow(summary.id);
        setActiveSavedWorkflowId(summary.id);
        onWorkflowLoaded({
          workflow: duplicated,
          path: null,
          savedId: summary.id,
        });
      } catch (err) {
        onNotify({
          tone: "error",
          message:
            err instanceof Error
              ? err.message
              : "Impossible de dupliquer le workflow",
        });
      } finally {
        setPendingSavedWorkflowId(null);
      }
    },
    [isDesktop, onNotify, onWorkflowLoaded, refreshSavedWorkflows]
  );

  const handleExportWorkflow = () => {
    if (!workflow) return;
    const yaml = serializeWorkflowToYaml(workflow);
    const fileStem = workflow.name
      ? workflow.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, "-") || "workflow"
      : "workflow";
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileStem}.yaml`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const currentYaml = useMemo(
    () => (workflow ? serializeWorkflowToYaml(workflow) : null),
    [workflow]
  );

  const validationTone = computeValidationTone(
    validationStatus,
    validationMessages
  );

  return (
    <div className="card" style={commandeurStyles.card}>
      <div style={commandeurStyles.stepperRow}>
        <div>
          <h3 style={{ margin: 0 }}>2. Importer et vérifier le workflow</h3>
          <p
            style={{
              margin: ".35rem 0 0",
              color: "#4b5563",
              fontSize: ".85rem",
            }}
          >
            Vous pouvez importer une configuration existante ou construire un
            workflow complet directement dans l'éditeur graphique.
          </p>
        </div>
        {workflow && (
          <div style={commandeurStyles.actionsRow}>
            <button className="btn" onClick={onReset}>
              Réinitialiser le workflow
            </button>
          </div>
        )}
      </div>

      {!workspace && (
        <div style={commandeurStyles.emptyState}>
          Chargez d'abord un workspace (étape 1) pour activer le chargement du
          workflow.
        </div>
      )}

      <div
        style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" as const }}
      >
        <button
          className="btn"
          onClick={createEmptyWorkflow}
          disabled={!workspace}
        >
          Nouveau workflow
        </button>
        <button
          className="btn btn-primary"
          onClick={loadWorkflowFromFile}
          disabled={!workspace || isValidating}
        >
          Importer
        </button>
        <button
          className="btn"
          onClick={handleExportWorkflow}
          disabled={!workflow}
        >
          Exporter
        </button>
        <button
          className="btn"
          onClick={handleSaveWorkflow}
          disabled={!workflow || !isDesktop || isSavingWorkflow}
        >
          {isSavingWorkflow ? "Enregistrement…" : "Enregistrer dans Raisin"}
        </button>
      </div>

      {(importError || validationError) && (
        <div style={commandeurStyles.badge("error")}>
          Erreur : {importError || validationError}
        </div>
      )}

      {saveError && (
        <div style={commandeurStyles.badge("error")}>
          Erreur d'enregistrement : {saveError}
        </div>
      )}

      {isDesktop && (
        <section
          style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              flexWrap: "wrap" as const,
              gap: ".5rem",
            }}
          >
            <h4 style={{ margin: 0 }}>Workflows sauvegardés</h4>
          </div>
          {savedWorkflowsError && (
            <div style={commandeurStyles.badge("error")}>
              {savedWorkflowsError}
            </div>
          )}
          {!savedWorkflowsError &&
            savedWorkflows.length === 0 &&
            !isLoadingSavedWorkflows && (
              <div style={commandeurStyles.emptyState}>
                Aucun workflow enregistré pour le moment.
              </div>
            )}
          {savedWorkflows.length > 0 && (
            <ul style={commandeurStyles.savedPillList}>
              {savedWorkflows.map((entry) => {
                const isActive = entry.id === savedWorkflowId;
                const isBusy = pendingSavedWorkflowId === entry.id;
                return (
                  <li
                    key={entry.id}
                    style={commandeurStyles.savedPill(isActive)}
                  >
                    <button
                      type="button"
                      style={commandeurStyles.savedPillLabel}
                      onClick={() => {
                        void handleLoadSavedWorkflow(entry);
                      }}
                      disabled={isValidating || isBusy}
                    >
                      {entry.name}
                    </button>
                    <div style={commandeurStyles.savedPillActions}>
                      <button
                        type="button"
                        style={commandeurStyles.savedPillActionButton}
                        onClick={() => {
                          void handleDuplicateSavedWorkflow(entry);
                        }}
                        disabled={isBusy}
                        aria-label={`Dupliquer ${entry.name}`}
                        title={`Dupliquer ${entry.name} (créera une copie indépendante)`}
                      >
                        <span aria-hidden="true">⧉</span>
                      </button>
                      <button
                        type="button"
                        style={commandeurStyles.savedPillActionButton}
                        onClick={() => {
                          void handleDeleteSavedWorkflow(entry);
                        }}
                        disabled={isBusy}
                        aria-label={`Supprimer ${entry.name}`}
                        title={`Supprimer ${entry.name} de la liste sauvegardée`}
                      >
                        <span aria-hidden="true">🗑️</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {workflow && (
        <section
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {workflowPath && (
            <div style={commandeurStyles.badgeRow}>
              <span style={commandeurStyles.badge("neutral")}>
                Fichier : {workflowPath}
              </span>
            </div>
          )}

          <WorkflowEditor
            workflow={workflow}
            onWorkflowChange={(updated) => {
              onWorkflowChanged(updated);
              setImportError(null);
              setSaveError(null);
            }}
          />

          <div style={commandeurStyles.actionsRow}>
            <button
              className="btn"
              onClick={() => {
                void onValidate({ advanceOnSuccess: true });
              }}
              disabled={isValidating || !workspace}
            >
              {isValidating ? "Validation en cours…" : "Relancer la validation"}
            </button>
            <span style={commandeurStyles.badge(validationTone)}>
              {validationStatus === "running"
                ? "Validation automatique en cours"
                : validationMessages.length === 0
                ? "Validation automatique à jour"
                : `${validationMessages.length} résultat(s) de validation`}
            </span>
          </div>

          {validationMessages.length > 0 && (
            <ul style={commandeurStyles.list}>
              {validationMessages.map((msg) => {
                const displayLabel =
                  msg.operationLabel ??
                  (msg.level !== "info" ? "Opération" : undefined);
                return (
                  <li
                    key={msg.operationId + msg.message}
                    style={commandeurStyles.listItem}
                  >
                    <div style={commandeurStyles.badgeRow}>
                      <span
                        style={commandeurStyles.badge(
                          msg.level === "error"
                            ? "error"
                            : msg.level === "warning"
                            ? "warning"
                            : "neutral"
                        )}
                      >
                        {msg.level.toUpperCase()}
                      </span>
                      {displayLabel && <strong>{displayLabel}</strong>}
                    </div>
                    <div>{msg.message}</div>
                    {msg.details && (
                      <div style={{ fontSize: ".75rem", color: "#4b5563" }}>
                        {msg.details}
                      </div>
                    )}
                    {msg.folders && msg.folders.length > 0 && (
                      <div style={{ fontSize: ".75rem", color: "#4b5563" }}>
                        Dossiers : {msg.folders.join(", ")}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {currentYaml && (
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Aperçu de la configuration actuelle
              </summary>
              <pre
                style={{
                  background: "#0f172a",
                  color: "#e2e8f0",
                  padding: "1rem",
                  borderRadius: ".75rem",
                  overflow: "auto",
                  maxHeight: "260px",
                }}
              >
                <code>{currentYaml}</code>
              </pre>
            </details>
          )}
        </section>
      )}

      {!workflow && (
        <div style={commandeurStyles.emptyState}>
          Aucun workflow chargé pour l'instant. Importez un fichier YAML ou
          créez un nouveau workflow pour continuer.
        </div>
      )}
    </div>
  );
};

export default WorkflowStep;
