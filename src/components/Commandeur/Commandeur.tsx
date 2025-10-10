import React, { useCallback, useMemo, useState } from "react";
import "../../styles/layout.css";
import { Stepper } from "../Stepper/Stepper";
import { commandeurStyles } from "./Commandeur.styles";
import WorkspaceStep from "./WorkspaceStep";
import WorkflowStep from "./WorkflowStep";
import ExecutionStep from "./ExecutionStep";
import type {
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

export const Commandeur: React.FC<CommandeurProps> = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState<StepId>(0);
  const [workspace, setWorkspace] = useState<CommandeurWorkspaceSummary | null>(
    null
  );
  const [workflow, setWorkflow] = useState<CommandeurWorkflow | null>(null);
  const [workflowSource, setWorkflowSource] = useState<string | null>(null);
  const [workflowPath, setWorkflowPath] = useState<string | null>(null);

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

  const steps = useMemo(
    () => [
      { id: 0, label: "Workspace" },
      { id: 1, label: "Workflow", disabled: !workspace },
      { id: 2, label: "Exécution", disabled: !workspace || !workflow },
    ],
    [workspace, workflow]
  );

  const goToStep = useCallback(
    (id: number | string) => {
      const target = Number(id) as StepId;
      if (target === 1 && !workspace) return;
      if (target === 2 && (!workspace || !workflow)) return;
      setCurrentStep(target);
    },
    [workspace, workflow]
  );

  const resetWorkflow = useCallback(() => {
    setWorkflow(null);
    setWorkflowSource(null);
    setWorkflowPath(null);
    setValidationMessages([]);
    setValidationStatus("idle");
    setValidationError(null);
    setExecutionResult(null);
    setExecutionError(null);
  }, []);

  const resetWorkspace = useCallback(() => {
    setWorkspace(null);
    resetWorkflow();
    setCurrentStep(0);
  }, [resetWorkflow]);

  const handleWorkspaceReady = useCallback(
    (summary: CommandeurWorkspaceSummary) => {
      setWorkspace(summary);
      setCurrentStep(1);
    },
    []
  );

  const handleWorkflowLoaded = useCallback(
    ({
      workflow: parsed,
      source,
      path,
    }: {
      workflow: CommandeurWorkflow;
      source: string;
      path: string | null;
    }) => {
      setWorkflow(parsed);
      setWorkflowSource(source);
      setWorkflowPath(path);
      setValidationMessages([]);
      setValidationStatus("idle");
      setValidationError(null);
      setExecutionResult(null);
      setExecutionError(null);
    },
    []
  );

  const determineStatusFromMessages = useCallback(
    (messages: CommandeurValidationMessage[]) => {
      if (messages.some((m) => m.level === "error")) return "error" as const;
      if (messages.some((m) => m.level === "warning"))
        return "warning" as const;
      return "success" as const;
    },
    []
  );

  const handleValidate = useCallback(async () => {
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
      if (status === "success") {
        setCurrentStep(2);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : String(err));
      setValidationStatus("error");
    } finally {
      setIsValidating(false);
    }
  }, [workspace, workflow, determineStatusFromMessages]);

  const handleExecute = useCallback(async () => {
    if (!workspace || !workflow) return;
    try {
      setIsExecuting(true);
      setExecutionError(null);
      const result = await executeCommandeurWorkflow(
        workspace.workspaceId,
        workflow
      );
      setExecutionResult(result);
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
            onReset={resetWorkspace}
          />
        )}

        {currentStep === 1 && (
          <WorkflowStep
            workspace={workspace}
            workflow={workflow}
            workflowSource={workflowSource}
            workflowPath={workflowPath}
            validationMessages={validationMessages}
            validationStatus={validationStatus}
            isValidating={isValidating}
            validationError={validationError}
            onWorkflowLoaded={handleWorkflowLoaded}
            onReset={resetWorkflow}
            onValidate={handleValidate}
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
          />
        )}
      </main>
    </div>
  );
};

export default Commandeur;
