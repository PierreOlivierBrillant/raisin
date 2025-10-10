import React from "react";
import { commandeurStyles } from "./Commandeur.styles";
import type {
  CommandeurExecutionLogEntry,
  CommandeurExecutionResult,
  CommandeurValidationMessage,
  CommandeurWorkflow,
  CommandeurWorkspaceSummary,
} from "../../types";

interface ExecutionStepProps {
  workspace: CommandeurWorkspaceSummary | null;
  workflow: CommandeurWorkflow | null;
  validationMessages: CommandeurValidationMessage[];
  onExecute: () => Promise<void>;
  executionResult: CommandeurExecutionResult | null;
  executionError: string | null;
  isExecuting: boolean;
}

function formatLevel(level: CommandeurExecutionLogEntry["level"]) {
  switch (level) {
    case "info":
      return "neutral" as const;
    case "warning":
      return "warning" as const;
    case "error":
      return "error" as const;
    default:
      return "neutral" as const;
  }
}

export const ExecutionStep: React.FC<ExecutionStepProps> = ({
  workspace,
  workflow,
  validationMessages,
  onExecute,
  executionResult,
  executionError,
  isExecuting,
}) => {
  const hasBlockingErrors = validationMessages.some((m) => m.level === "error");

  return (
    <div className="card" style={commandeurStyles.card}>
      <div style={commandeurStyles.stepperRow}>
        <div>
          <h3 style={{ margin: 0 }}>3. Exécuter le workflow</h3>
          <p
            style={{
              margin: ".35rem 0 0",
              color: "#4b5563",
              fontSize: ".85rem",
            }}
          >
            Lancez l'exécution des opérations sur chaque sous-dossier détecté.
          </p>
        </div>
      </div>

      {!workspace && (
        <div style={commandeurStyles.emptyState}>
          Chargez un workspace à l'étape 1 avant d'exécuter le workflow.
        </div>
      )}

      {!workflow && (
        <div style={commandeurStyles.emptyState}>
          Importez un workflow YAML à l'étape 2 pour lancer l'exécution.
        </div>
      )}

      <div style={commandeurStyles.actionsRow}>
        <button
          className="btn btn-primary"
          onClick={onExecute}
          disabled={!workspace || !workflow || isExecuting || hasBlockingErrors}
        >
          {isExecuting ? "Exécution en cours…" : "Lancer l'exécution"}
        </button>
        {hasBlockingErrors && (
          <span style={commandeurStyles.badge("error")}>
            Corrigez les erreurs de validation avant d'exécuter.
          </span>
        )}
        {executionResult && (
          <span
            style={commandeurStyles.badge(
              executionResult.success ? "success" : "error"
            )}
          >
            {executionResult.success
              ? "Exécution terminée"
              : "Exécution terminée avec erreurs"}
          </span>
        )}
      </div>

      {executionError && (
        <div style={commandeurStyles.badge("error")}>
          Erreur : {executionError}
        </div>
      )}

      {executionResult && (
        <section
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div style={commandeurStyles.badgeRow}>
            <span style={commandeurStyles.badge("neutral")}>
              Opérations exécutées : {executionResult.operationsRun}
            </span>
            <span style={commandeurStyles.badge("neutral")}>
              Fichier log : {executionResult.logFilePath}
            </span>
            {executionResult.outputArchivePath && (
              <span style={commandeurStyles.badge("neutral")}>
                Archive générée : {executionResult.outputArchivePath}
              </span>
            )}
          </div>

          <div>
            <h4 style={{ margin: "0 0 .35rem" }}>Journal d'exécution</h4>
            <div style={commandeurStyles.logList}>
              {executionResult.logEntries.map((entry) => (
                <div
                  key={`${entry.timestamp}-${entry.operationId}-${entry.message}`}
                  style={{
                    ...commandeurStyles.logEntry,
                    borderLeftColor:
                      formatLevel(entry.level) === "warning"
                        ? "#f59e0b"
                        : formatLevel(entry.level) === "error"
                        ? "#ef4444"
                        : "#2563eb",
                    background:
                      formatLevel(entry.level) === "warning"
                        ? "#fef3c7"
                        : formatLevel(entry.level) === "error"
                        ? "#fee2e2"
                        : "#eff6ff",
                  }}
                >
                  <strong>[{entry.operationLabel}]</strong> {entry.message}
                  <div style={{ fontSize: ".7rem", color: "#4b5563" }}>
                    {entry.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ margin: "0 0 .35rem" }}>Avertissements</h4>
            {executionResult.warnings.length ? (
              <ul style={commandeurStyles.list}>
                {executionResult.warnings.map((warn) => (
                  <li
                    key={`${warn.operationId}-${warn.message}`}
                    style={commandeurStyles.listItem}
                  >
                    <span style={commandeurStyles.badge("warning")}>
                      AVERTISSEMENT
                    </span>
                    <div>{warn.message}</div>
                    {warn.details && (
                      <div style={{ fontSize: ".75rem", color: "#4b5563" }}>
                        {warn.details}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={commandeurStyles.emptyState}>
                Aucun avertissement.
              </div>
            )}
          </div>

          <div>
            <h4 style={{ margin: "0 0 .35rem" }}>Erreurs</h4>
            {executionResult.errors.length ? (
              <ul style={commandeurStyles.list}>
                {executionResult.errors.map((err) => (
                  <li
                    key={`${err.operationId}-${err.message}`}
                    style={commandeurStyles.listItem}
                  >
                    <span style={commandeurStyles.badge("error")}>ERREUR</span>
                    <div>{err.message}</div>
                    {err.details && (
                      <div style={{ fontSize: ".75rem", color: "#4b5563" }}>
                        {err.details}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={commandeurStyles.emptyState}>Aucune erreur.</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default ExecutionStep;
