import React, { useEffect, useMemo, useRef, useState } from "react";
import { commandeurStyles } from "./Commandeur.styles";
import type {
  CommandeurExecutionLogEntry,
  CommandeurExecutionResult,
  CommandeurValidationMessage,
  CommandeurWorkflow,
  CommandeurWorkspaceSummary,
} from "../../types";
import ProgressBar from "../ProgressBar/ProgressBar";

interface ExecutionStepProps {
  workspace: CommandeurWorkspaceSummary | null;
  workflow: CommandeurWorkflow | null;
  validationMessages: CommandeurValidationMessage[];
  onExecute: () => Promise<void>;
  executionResult: CommandeurExecutionResult | null;
  executionError: string | null;
  isExecuting: boolean;
  liveLogEntries: CommandeurExecutionLogEntry[];
  liveWarnings: CommandeurValidationMessage[];
  liveErrors: CommandeurValidationMessage[];
  isDesktopRuntime: boolean;
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
  liveLogEntries,
  liveWarnings,
  liveErrors,
  isDesktopRuntime,
}) => {
  const hasBlockingErrors = validationMessages.some((m) => m.level === "error");
  const logEntries = executionResult
    ? executionResult.logEntries
    : liveLogEntries;
  const warnings = executionResult ? executionResult.warnings : liveWarnings;
  const errors = executionResult ? executionResult.errors : liveErrors;
  const hasLogEntries = logEntries.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasErrors = errors.length > 0;
  const showResultsSection =
    hasLogEntries ||
    hasWarnings ||
    hasErrors ||
    Boolean(executionResult) ||
    isExecuting;
  const latestLogEntry = useMemo(
    () => (logEntries.length ? logEntries[logEntries.length - 1] : null),
    [logEntries]
  );
  const eventsCountLabel = useMemo(
    () => `${logEntries.length} événement${logEntries.length > 1 ? "s" : ""}`,
    [logEntries.length]
  );
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const prevScrollHeight = useRef(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const progressValue = useMemo(() => {
    if (!workflow || workflow.operations.length === 0) return 0;
    const enabledOps = workflow.operations.filter((op) => op.enabled).length;
    const foldersCount = workspace?.subFolders.length ?? 1;
    const totalExpected = Math.max(1, enabledOps * foldersCount);
    return Math.min(1, logEntries.length / totalExpected);
  }, [workflow, logEntries.length, workspace?.subFolders.length]);

  useEffect(() => {
    const handleScroll = () => {
      const container = logContainerRef.current;
      if (!container) return;
      const distanceFromBottom =
        container.scrollHeight - container.clientHeight - container.scrollTop;
      const atBottom = distanceFromBottom <= 2;
      setIsUserScrolling(!atBottom);
      setAutoScrollEnabled((prev) => {
        if (atBottom) return true;
        return prev ? false : prev;
      });
    };

    const container = logContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

    if (autoScrollEnabled) {
      container.scrollTop = container.scrollHeight;
    }

    prevScrollHeight.current = container.scrollHeight;
  }, [logEntries.length, warnings.length, errors.length, autoScrollEnabled]);

  const statusBadgeTone = useMemo(() => {
    if (isExecuting) return "neutral" as const;
    if (executionResult) {
      return executionResult.success
        ? ("success" as const)
        : ("error" as const);
    }
    return "neutral" as const;
  }, [isExecuting, executionResult]);

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

      {isExecuting && <ProgressBar value={progressValue} height={8} />}

      <div style={commandeurStyles.statusRow}>
        <span style={commandeurStyles.badge(statusBadgeTone)}>
          {isExecuting
            ? `Exécution en cours (${eventsCountLabel})`
            : executionResult
            ? executionResult.success
              ? "Exécution terminée"
              : "Exécution terminée avec erreurs"
            : "Prêt à exécuter"}
        </span>
        {latestLogEntry && (
          <span style={commandeurStyles.statusText}>
            Dernier événement · [{latestLogEntry.operationLabel}]{" "}
            {latestLogEntry.message}
          </span>
        )}
      </div>

      {!isDesktopRuntime && (
        <div style={commandeurStyles.emptyState}>
          Le suivi en direct nécessite l'application desktop de Raisin.
        </div>
      )}

      {showResultsSection && (
        <section
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {executionResult && (
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
          )}

          <div>
            <h4 style={{ margin: "0 0 .35rem" }}>Journal d'exécution</h4>
            {hasLogEntries ? (
              <div
                ref={logContainerRef}
                style={commandeurStyles.logList}
                data-user-scrolling={isUserScrolling ? "true" : "false"}
              >
                {logEntries.map((entry) => {
                  const tone = formatLevel(entry.level);
                  const borderColor =
                    tone === "warning"
                      ? "#f59e0b"
                      : tone === "error"
                      ? "#ef4444"
                      : "#2563eb";
                  const backgroundColor =
                    tone === "warning"
                      ? "#fdf6d8"
                      : tone === "error"
                      ? "#fce8e8"
                      : "#f5f7fb";
                  return (
                    <div
                      key={`${entry.timestamp}-${entry.operationId}-${entry.message}`}
                      style={{
                        ...commandeurStyles.logEntry,
                        borderLeftColor: borderColor,
                        background: backgroundColor,
                      }}
                    >
                      <span style={commandeurStyles.logEntryTimestamp}>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <div style={commandeurStyles.logEntryBody}>
                        <span>
                          <strong>{entry.operationLabel}</strong>
                          {entry.message ? ` · ${entry.message}` : ""}
                        </span>
                        {tone !== "neutral" && (
                          <span
                            style={{ fontSize: ".65rem", color: "#4b5563" }}
                          >
                            #{entry.operationId}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={commandeurStyles.emptyState}>
                {isExecuting
                  ? "En attente des premiers journaux…"
                  : "Aucun journal disponible."}
              </div>
            )}
          </div>

          <div>
            <h4 style={{ margin: "0 0 .35rem" }}>Avertissements</h4>
            {hasWarnings ? (
              <div style={commandeurStyles.alertList}>
                {warnings.map((warn) => {
                  const label = warn.operationLabel ?? "Opération";
                  return (
                    <div
                      key={`${warn.operationId}-${warn.message}`}
                      style={{
                        ...commandeurStyles.logEntry,
                        borderLeftColor: "#f59e0b",
                        background: "#fdf6d8",
                      }}
                    >
                      <span
                        style={{
                          ...commandeurStyles.logEntryTimestamp,
                          color: "#b45309",
                        }}
                      >
                        {label}
                      </span>
                      <div style={commandeurStyles.logEntryBody}>
                        <span>{warn.message}</span>
                        {warn.details && (
                          <span
                            style={{ fontSize: ".68rem", color: "#92400e" }}
                          >
                            {warn.details}
                          </span>
                        )}
                        {warn.folders && warn.folders.length > 0 && (
                          <span
                            style={{ fontSize: ".68rem", color: "#92400e" }}
                          >
                            Dossiers : {warn.folders.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={commandeurStyles.emptyState}>
                {isExecuting
                  ? "Aucun avertissement pour l'instant."
                  : "Aucun avertissement."}
              </div>
            )}
          </div>

          <div>
            <h4 style={{ margin: "0 0 .35rem" }}>Erreurs</h4>
            {hasErrors ? (
              <ul style={commandeurStyles.list}>
                {errors.map((err) => (
                  <li
                    key={`${err.operationId}-${err.message}`}
                    style={commandeurStyles.listItem}
                  >
                    <span style={commandeurStyles.badge("error")}>ERREUR</span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: ".25rem",
                      }}
                    >
                      <span>
                        <strong>
                          {err.operationLabel ??
                            (err.operationId === "__workspace__"
                              ? "Workspace"
                              : "Opération")}
                        </strong>
                        {` · ${err.message}`}
                      </span>
                      {err.details && (
                        <span style={{ fontSize: ".75rem", color: "#4b5563" }}>
                          {err.details}
                        </span>
                      )}
                      {err.folders && err.folders.length > 0 && (
                        <span style={{ fontSize: ".75rem", color: "#4b5563" }}>
                          Dossiers : {err.folders.join(", ")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={commandeurStyles.emptyState}>
                {isExecuting
                  ? "Aucune erreur pour l'instant."
                  : "Aucune erreur."}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default ExecutionStep;
