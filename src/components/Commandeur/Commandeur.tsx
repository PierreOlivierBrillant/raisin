import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "../../styles/layout.css";
import { Stepper } from "../Stepper/Stepper";
import { commandeurStyles } from "./Commandeur.styles";
import WorkspaceStep from "./WorkspaceStep";
import WorkflowStep from "./WorkflowStep";
import ExecutionStep from "./ExecutionStep";
import Toast, { type ToastMessage, type ToastTone } from "../Toast/Toast";
import type {
  CommandeurExecutionLogEntry,
  CommandeurExecutionResult,
  CommandeurValidationMessage,
  CommandeurWorkflow,
  CommandeurWorkspaceSummary,
} from "../../types";
import {
  executeCommandeurWorkflow,
  validateCommandeurWorkflow,
} from "../../services/commandeur/api";

interface CommandeurProps {
  onBack?: () => void;
}

type StepId = 0 | 1 | 2;

const LOG_EVENT = "commandeur://execution-log";
const VALIDATION_EVENT = "commandeur://execution-validation";

export const Commandeur: React.FC<CommandeurProps> = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState<StepId>(0);
  const [workspace, setWorkspace] = useState<CommandeurWorkspaceSummary | null>(
    null
  );
  const [workspaceConfirmed, setWorkspaceConfirmed] = useState(false);
  const [workflow, setWorkflow] = useState<CommandeurWorkflow | null>(null);
  const [workflowPath, setWorkflowPath] = useState<string | null>(null);
  const [savedWorkflowId, setSavedWorkflowId] = useState<string | null>(null);

  const [liveLogEntries, setLiveLogEntries] = useState<
    CommandeurExecutionLogEntry[]
  >([]);
  const [liveWarnings, setLiveWarnings] = useState<
    CommandeurValidationMessage[]
  >([]);
  const [liveErrors, setLiveErrors] = useState<CommandeurValidationMessage[]>(
    []
  );

  const [validationMessages, setValidationMessages] = useState<
    CommandeurValidationMessage[]
  >([]);
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "running" | "success" | "warning" | "error"
  >("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [executionResult, setExecutionResult] =
    useState<CommandeurExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDesktopRuntime, setIsDesktopRuntime] = useState(false);
  const lastValidationRef = useRef<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const toastCounterRef = useRef(0);

  useEffect(() => {
    const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;
    setIsDesktopRuntime(isDesktop);
    if (!isDesktop) {
      return () => {
        /* noop */
      };
    }

    let unlistenLog: UnlistenFn | null = null;
    let unlistenValidation: UnlistenFn | null = null;
    let active = true;

    (async () => {
      try {
        unlistenLog = await listen<CommandeurExecutionLogEntry>(
          LOG_EVENT,
          (event) => {
            if (!active) return;
            setLiveLogEntries((prev) => [...prev, event.payload]);
          }
        );
        unlistenValidation = await listen<CommandeurValidationMessage>(
          VALIDATION_EVENT,
          (event) => {
            if (!active) return;
            if (event.payload.level === "error") {
              setLiveErrors((prev) => [...prev, event.payload]);
            } else {
              setLiveWarnings((prev) => [...prev, event.payload]);
            }
          }
        );
      } catch (err) {
        console.warn("Impossible d'écouter les événements Commandeur", err);
      }
    })();

    return () => {
      active = false;
      if (unlistenLog) unlistenLog();
      if (unlistenValidation) unlistenValidation();
    };
  }, []);

  const steps = useMemo(
    () => [
      { id: 0, label: "Workspace" },
      {
        id: 1,
        label: "Workflow",
        disabled: !workspace || !workspaceConfirmed,
      },
      {
        id: 2,
        label: "Exécution",
        disabled: !workspace || !workspaceConfirmed || !workflow,
      },
    ],
    [workspace, workspaceConfirmed, workflow]
  );

  const goToStep = useCallback(
    (id: number | string) => {
      const target = Number(id) as StepId;
      if (target === 1 && (!workspace || !workspaceConfirmed)) return;
      if (target === 2 && (!workspace || !workspaceConfirmed || !workflow))
        return;
      setCurrentStep(target);
    },
    [workspace, workspaceConfirmed, workflow]
  );

  const resetWorkflow = useCallback(() => {
    setWorkflow(null);
    setWorkflowPath(null);
    setValidationMessages([]);
    setValidationStatus("idle");
    setValidationError(null);
    setExecutionResult(null);
    setExecutionError(null);
    setLiveLogEntries([]);
    setLiveWarnings([]);
    setLiveErrors([]);
    setSavedWorkflowId(null);
    lastValidationRef.current = null;
  }, []);

  const resetWorkspace = useCallback(() => {
    setWorkspace(null);
    resetWorkflow();
    setWorkspaceConfirmed(false);
    setCurrentStep(0);
    lastValidationRef.current = null;
  }, [resetWorkflow]);

  const handleWorkspaceReady = useCallback(
    (summary: CommandeurWorkspaceSummary) => {
      resetWorkflow();
      setWorkspace(summary);
      setWorkspaceConfirmed(false);
      setCurrentStep(0);
      lastValidationRef.current = null;
    },
    [resetWorkflow]
  );

  const handleConfirmWorkspace = useCallback(() => {
    if (!workspace) return;
    setWorkspaceConfirmed(true);
    setCurrentStep(1);
  }, [workspace]);

  const handleWorkflowSaved = useCallback((id: string | null) => {
    setSavedWorkflowId(id);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timeout = toastTimeoutsRef.current[id];
    if (timeout) {
      clearTimeout(timeout);
      delete toastTimeoutsRef.current[id];
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: { tone: ToastTone; message: string }) => {
      toastCounterRef.current += 1;
      const id = `toast-${Date.now()}-${toastCounterRef.current}`;
      setToasts((prev) => [
        ...prev,
        { id, tone: toast.tone, message: toast.message },
      ]);
      const timeout = setTimeout(() => {
        dismissToast(id);
      }, 4000);
      toastTimeoutsRef.current[id] = timeout;
    },
    [dismissToast]
  );

  useEffect(() => {
    return () => {
      Object.values(toastTimeoutsRef.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
      toastTimeoutsRef.current = {};
    };
  }, []);

  const handleWorkflowLoaded = useCallback(
    ({
      workflow: parsed,
      path,
      savedId = null,
    }: {
      workflow: CommandeurWorkflow;
      path: string | null;
      savedId?: string | null;
    }) => {
      setWorkflow(parsed);
      setWorkflowPath(path);
      setSavedWorkflowId(savedId);
      lastValidationRef.current = null;
      setValidationMessages([]);
      setValidationStatus("idle");
      setValidationError(null);
      setExecutionResult(null);
      setExecutionError(null);
      setLiveLogEntries([]);
      setLiveWarnings([]);
      setLiveErrors([]);
    },
    []
  );

  const handleWorkflowChanged = useCallback((updated: CommandeurWorkflow) => {
    lastValidationRef.current = null;
    setWorkflow(updated);
    setValidationMessages([]);
    setValidationStatus("idle");
    setValidationError(null);
    setExecutionResult(null);
    setExecutionError(null);
    setLiveLogEntries([]);
    setLiveWarnings([]);
    setLiveErrors([]);
  }, []);

  const determineStatusFromMessages = useCallback(
    (messages: CommandeurValidationMessage[]) => {
      if (messages.some((m) => m.level === "error")) return "error" as const;
      if (messages.some((m) => m.level === "warning"))
        return "warning" as const;
      return "success" as const;
    },
    []
  );

  const handleValidate = useCallback(
    async ({
      advanceOnSuccess = false,
    }: { advanceOnSuccess?: boolean } = {}) => {
      if (!workspace || !workflow) return;
      try {
        setIsValidating(true);
        setValidationStatus("running");
        setValidationError(null);
        const messages = await validateCommandeurWorkflow(
          workspace.workspaceId,
          workflow
        );
        setValidationMessages(messages);
        const status = determineStatusFromMessages(messages);
        setValidationStatus(status);
        if (
          advanceOnSuccess &&
          (status === "success" || status === "warning")
        ) {
          setCurrentStep(2);
        }
      } catch (err) {
        setValidationError(err instanceof Error ? err.message : String(err));
        setValidationStatus("error");
        lastValidationRef.current = null;
      } finally {
        setIsValidating(false);
      }
    },
    [workspace, workflow, determineStatusFromMessages]
  );

  useEffect(() => {
    if (!workspace || !workflow || !workspaceConfirmed) return;
    if (isValidating) return;
    const key = `${workspace.workspaceId}:${JSON.stringify(workflow)}`;
    if (lastValidationRef.current === key) return;
    lastValidationRef.current = key;
    void handleValidate();
  }, [workspace, workflow, workspaceConfirmed, isValidating, handleValidate]);

  const handleExecute = useCallback(async () => {
    if (!workspace || !workflow) return;
    try {
      setExecutionResult(null);
      setIsExecuting(true);
      setExecutionError(null);
      setLiveLogEntries([]);
      setLiveWarnings([]);
      setLiveErrors([]);
      const result = await executeCommandeurWorkflow(
        workspace.workspaceId,
        workflow
      );
      setExecutionResult(result);
      setLiveLogEntries(result.logEntries);
      setLiveWarnings(result.warnings);
      setLiveErrors(result.errors);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  }, [workspace, workflow]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Raisin 🍇</h1>
        <h2>Commandeur</h2>
        {onBack && (
          <div style={{ position: "absolute", left: 16, top: 12 }}>
            <button className="btn" onClick={onBack}>
              &larr; Accueil
            </button>
          </div>
        )}
      </header>
      <main className="main-content" style={commandeurStyles.page}>
        <Stepper steps={steps} current={currentStep} onChange={goToStep} />

        {currentStep === 0 && (
          <WorkspaceStep
            workspace={workspace}
            onWorkspaceReady={handleWorkspaceReady}
            workspaceConfirmed={workspaceConfirmed}
            onConfirm={handleConfirmWorkspace}
            onReset={resetWorkspace}
          />
        )}

        {currentStep === 1 && (
          <WorkflowStep
            workspace={workspace}
            workflow={workflow}
            workflowPath={workflowPath}
            savedWorkflowId={savedWorkflowId}
            validationMessages={validationMessages}
            validationStatus={validationStatus}
            isValidating={isValidating}
            validationError={validationError}
            onWorkflowLoaded={handleWorkflowLoaded}
            onWorkflowChanged={handleWorkflowChanged}
            onReset={resetWorkflow}
            onValidate={handleValidate}
            onWorkflowSaved={handleWorkflowSaved}
            onNotify={pushToast}
          />
        )}

        {currentStep === 2 && (
          <ExecutionStep
            workspace={workspace}
            workflow={workflow}
            validationMessages={validationMessages}
            onExecute={handleExecute}
            executionResult={executionResult}
            executionError={executionError}
            isExecuting={isExecuting}
            liveLogEntries={liveLogEntries}
            liveWarnings={liveWarnings}
            liveErrors={liveErrors}
            isDesktopRuntime={isDesktopRuntime}
          />
        )}
      </main>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default Commandeur;
