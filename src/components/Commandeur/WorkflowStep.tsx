import React, { useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { readTextFile } from "@tauri-apps/api/fs";
import { commandeurStyles } from "./Commandeur.styles";
import type {
  CommandeurValidationMessage,
  CommandeurWorkflow,
  CommandeurWorkspaceSummary,
} from "../../types";
import { parseWorkflowYaml } from "../../services/commandeur/workflowYaml";

interface WorkflowStepProps {
  workspace: CommandeurWorkspaceSummary | null;
  workflow: CommandeurWorkflow | null;
  workflowSource: string | null;
  workflowPath: string | null;
  validationMessages: CommandeurValidationMessage[];
  validationStatus: "idle" | "running" | "success" | "warning" | "error";
  isValidating: boolean;
  validationError: string | null;
  onWorkflowLoaded: (payload: {
    workflow: CommandeurWorkflow;
    source: string;
    path: string | null;
  }) => void;
  onReset: () => void;
  onValidate: () => Promise<void>;
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
  workflowSource,
  workflowPath,
  validationMessages,
  validationStatus,
  isValidating,
  validationError,
  onWorkflowLoaded,
  onReset,
  onValidate,
}) => {
  const [importError, setImportError] = useState<string | null>(null);

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
      onWorkflowLoaded({ workflow: parsed, source: content, path: selection });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

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
            Chargez un fichier YAML décrivant les opérations à exécuter pour
            chaque dossier étudiant.
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
          className="btn btn-primary"
          onClick={loadWorkflowFromFile}
          disabled={!workspace || isValidating}
        >
          Importer un YAML…
        </button>
      </div>

      {(importError || validationError) && (
        <div style={commandeurStyles.badge("error")}>
          Erreur : {importError || validationError}
        </div>
      )}

      {workflow && (
        <section
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div style={commandeurStyles.badgeRow}>
            <span style={commandeurStyles.badge("neutral")}>
              Nom : {workflow.name}
            </span>
            <span style={commandeurStyles.badge("neutral")}>
              Version : {workflow.version ?? "1.0"}
            </span>
            <span style={commandeurStyles.badge("neutral")}>
              Opérations : {workflow.operations.length}
            </span>
            {workflowPath && (
              <span style={commandeurStyles.badge("neutral")}>
                Fichier : {workflowPath}
              </span>
            )}
          </div>

          <div style={commandeurStyles.actionsRow}>
            <button
              className="btn btn-primary"
              onClick={onValidate}
              disabled={isValidating || !workspace}
            >
              {isValidating ? "Validation en cours…" : "Valider le workflow"}
            </button>
            <span style={commandeurStyles.badge(validationTone)}>
              {validationStatus === "running"
                ? "Validation en cours"
                : validationMessages.length === 0
                ? "Aucun message de validation"
                : `${validationMessages.length} résultat(s) de validation`}
            </span>
          </div>

          {validationMessages.length > 0 && (
            <ul style={commandeurStyles.list}>
              {validationMessages.map((msg) => (
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
                    <strong>{msg.operationId}</strong>
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
              ))}
            </ul>
          )}

          <div>
            <h4 style={{ margin: "0 0 .35rem" }}>Aperçu des opérations</h4>
            <div style={commandeurStyles.summaryList}>
              {workflow.operations.map((op) => (
                <div
                  key={op.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ".2rem",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{op.label}</div>
                  <div style={{ fontSize: ".75rem", color: "#4b5563" }}>
                    Type : {op.kind}{" "}
                    {op.enabled === false ? "(désactivée)" : ""}
                  </div>
                  {op.comment && (
                    <div
                      style={{
                        fontSize: ".75rem",
                        color: "#4b5563",
                        fontStyle: "italic",
                      }}
                    >
                      {op.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {workflowSource && (
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Afficher le YAML importé
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
                <code>{workflowSource}</code>
              </pre>
            </details>
          )}
        </section>
      )}

      {!workflow && (
        <div style={commandeurStyles.emptyState}>
          Aucun workflow chargé pour l'instant. Importez un fichier YAML pour
          continuer.
        </div>
      )}
    </div>
  );
};

export default WorkflowStep;
