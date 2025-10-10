import React, { useEffect, useMemo, useState } from "react";
import type {
  CommandeurOperation,
  CommandeurOperationKind,
  CommandeurWorkflow,
} from "../../../types";
import type { CommandeurConditionalOperation } from "../../../types/Commandeur";
import { workflowEditorStyles } from "./WorkflowEditor.styles";

type OperationBranchKey = "then" | "else";
type OperationPath = Array<number | OperationBranchKey>;

const operationKindLabels: Record<CommandeurOperationKind, string> = {
  "create-file": "Créer un fichier",
  "delete-file": "Supprimer un fichier",
  copy: "Copier",
  exec: "Exécuter une commande",
  "replace-in-file": "Remplacer dans un fichier",
  rename: "Renommer",
  move: "Déplacer",
  mkdir: "Créer un dossier",
  python: "Script Python",
  if: "Condition",
};

const operationKindOptions = Object.entries(operationKindLabels).map(
  ([value, label]) => ({ value: value as CommandeurOperationKind, label })
);

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function generateOperationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op_${Math.random().toString(36).slice(2, 10)}_${Date.now()
    .toString(36)
    .slice(-4)}`;
}

function cloneOperationWithNewIds(
  operation: CommandeurOperation
): CommandeurOperation {
  const clone = deepClone(operation);
  const assignIds = (op: CommandeurOperation): void => {
    op.id = generateOperationId();
    if (op.kind === "if") {
      op.then = op.then.map((child) => {
        const childClone = deepClone(child);
        assignIds(childClone);
        return childClone;
      });
      op.else = (op.else ?? []).map((child) => {
        const childClone = deepClone(child);
        assignIds(childClone);
        return childClone;
      });
    }
  };
  assignIds(clone);
  return clone;
}

function createOperation(kind: CommandeurOperationKind): CommandeurOperation {
  const base = {
    id: generateOperationId(),
    label: operationKindLabels[kind],
    comment: "",
    enabled: true,
    kind,
    continueOnError: false,
  } as CommandeurOperation;

  switch (kind) {
    case "create-file":
      return {
        ...base,
        kind,
        target: "",
        overwrite: false,
        content: "",
      };
    case "delete-file":
      return {
        ...base,
        kind,
        target: "",
        required: false,
      };
    case "copy":
      return {
        ...base,
        kind,
        source: "",
        destination: "",
        overwrite: false,
      };
    case "exec":
      return {
        ...base,
        kind,
        command: "",
        args: [],
        shell: "default",
        cwd: undefined,
        env: undefined,
      };
    case "replace-in-file":
      return {
        ...base,
        kind,
        target: "",
        search: "",
        replace: "",
        mode: "plain",
        flags: undefined,
        preview: true,
      };
    case "rename":
      return {
        ...base,
        kind,
        target: "",
        mode: "suffix",
        value: "",
        search: undefined,
        replace: undefined,
      };
    case "move":
      return {
        ...base,
        kind,
        source: "",
        destination: "",
        overwrite: false,
      };
    case "mkdir":
      return {
        ...base,
        kind,
        target: "",
        recursive: true,
        skipIfExists: true,
      };
    case "python":
      return {
        ...base,
        kind,
        entry: "inline",
        inlineScript: "",
        scriptPath: undefined,
        detectExternalImports: true,
      };
    case "if":
      return {
        ...base,
        kind,
        test: {
          exists: "",
          negate: false,
        },
        then: [],
        else: [],
      };
    default:
      return base;
  }
}

function getOperationAtPath(
  operations: CommandeurOperation[],
  path: OperationPath | null
): CommandeurOperation | null {
  if (!path || path.length === 0) return null;
  let currentOps = operations;
  let currentOp: CommandeurOperation | null = null;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (typeof segment === "number") {
      currentOp = currentOps[segment];
      if (!currentOp) return null;
    } else {
      if (!currentOp || currentOp.kind !== "if") return null;
      currentOps = segment === "then" ? currentOp.then : currentOp.else ?? [];
      currentOp = null;
    }
  }
  return currentOp;
}

function replaceOperationAtPath(
  operations: CommandeurOperation[],
  path: OperationPath,
  updater: (operation: CommandeurOperation) => CommandeurOperation
): CommandeurOperation[] {
  if (path.length === 0) return operations;
  const [head, ...rest] = path;
  if (typeof head !== "number" || head < 0 || head >= operations.length) {
    return operations;
  }
  const target = operations[head];
  if (!target) return operations;
  if (rest.length === 0) {
    const updated = updater(target);
    if (updated === target) return operations;
    const next = [...operations];
    next[head] = updated;
    return next;
  }
  const [branch, ...branchRest] = rest;
  if (branch !== "then" && branch !== "else") return operations;
  if (target.kind !== "if") return operations;
  const branchOps = branch === "then" ? target.then : target.else ?? [];
  const updatedBranch = replaceOperationAtPath(branchOps, branchRest, updater);
  if (updatedBranch === branchOps) return operations;
  const next = [...operations];
  const updatedTarget: CommandeurConditionalOperation =
    branch === "then"
      ? { ...target, then: updatedBranch }
      : { ...target, else: updatedBranch };
  next[head] = updatedTarget;
  return next;
}

function removeOperationAtPath(
  operations: CommandeurOperation[],
  path: OperationPath
): CommandeurOperation[] {
  if (path.length === 0) return operations;
  const [head, ...rest] = path;
  if (typeof head !== "number" || head < 0 || head >= operations.length) {
    return operations;
  }
  if (rest.length === 0) {
    const next = [...operations];
    next.splice(head, 1);
    return next;
  }
  const [branch, ...branchRest] = rest;
  if (branch !== "then" && branch !== "else") return operations;
  const target = operations[head];
  if (!target || target.kind !== "if") return operations;
  const branchOps = branch === "then" ? target.then : target.else ?? [];
  const updatedBranch = removeOperationAtPath(branchOps, branchRest);
  if (updatedBranch === branchOps) return operations;
  const next = [...operations];
  const updatedTarget: CommandeurConditionalOperation =
    branch === "then"
      ? { ...target, then: updatedBranch }
      : { ...target, else: updatedBranch };
  next[head] = updatedTarget;
  return next;
}

function insertOperationAt(
  operations: CommandeurOperation[],
  path: OperationPath,
  newOperation: CommandeurOperation,
  position: "after" | "end"
): CommandeurOperation[] {
  if (position === "end" && path.length === 0) {
    return [...operations, newOperation];
  }
  if (path.length === 0) {
    const next = [...operations];
    next.push(newOperation);
    return next;
  }
  const [head, ...rest] = path;
  if (typeof head !== "number" || head < 0 || head >= operations.length) {
    return operations;
  }
  const target = operations[head];
  if (rest.length === 0) {
    const next = [...operations];
    next.splice(head + (position === "after" ? 1 : 0), 0, newOperation);
    return next;
  }
  const [branch, ...branchRest] = rest;
  if (branch !== "then" && branch !== "else") return operations;
  if (target.kind !== "if") return operations;
  const branchOps = branch === "then" ? target.then : target.else ?? [];
  const updatedBranch = insertOperationAt(
    branchOps,
    branchRest,
    newOperation,
    position
  );
  if (updatedBranch === branchOps) return operations;
  const next = [...operations];
  const updatedTarget: CommandeurConditionalOperation =
    branch === "then"
      ? { ...target, then: updatedBranch }
      : { ...target, else: updatedBranch };
  next[head] = updatedTarget;
  return next;
}

function moveOperation(
  operations: CommandeurOperation[],
  path: OperationPath,
  direction: "up" | "down"
): CommandeurOperation[] {
  if (path.length === 0) return operations;
  const [head, ...rest] = path;
  if (typeof head !== "number" || head < 0 || head >= operations.length) {
    return operations;
  }
  if (rest.length === 0) {
    const targetIndex = head + (direction === "up" ? -1 : 1);
    if (targetIndex < 0 || targetIndex >= operations.length) return operations;
    const next = [...operations];
    const [item] = next.splice(head, 1);
    next.splice(targetIndex, 0, item);
    return next;
  }
  const [branch, ...branchRest] = rest;
  if (branch !== "then" && branch !== "else") return operations;
  const target = operations[head];
  if (!target || target.kind !== "if") return operations;
  const branchOps = branch === "then" ? target.then : target.else ?? [];
  const updatedBranch = moveOperation(branchOps, branchRest, direction);
  if (updatedBranch === branchOps) return operations;
  const next = [...operations];
  const updatedTarget: CommandeurConditionalOperation =
    branch === "then"
      ? { ...target, then: updatedBranch }
      : { ...target, else: updatedBranch };
  next[head] = updatedTarget;
  return next;
}

interface WorkflowEditorProps {
  workflow: CommandeurWorkflow;
  onWorkflowChange: (workflow: CommandeurWorkflow) => void;
  onDuplicateRequest?: (operation: CommandeurOperation) => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflow,
  onWorkflowChange,
}) => {
  const [selectedPath, setSelectedPath] = useState<OperationPath | null>(
    workflow.operations.length ? [0] : null
  );

  useEffect(() => {
    if (!selectedPath) {
      if (workflow.operations.length) {
        setSelectedPath([0]);
      }
      return;
    }
    const op = getOperationAtPath(workflow.operations, selectedPath);
    if (!op) {
      if (workflow.operations.length) {
        setSelectedPath([0]);
      } else {
        setSelectedPath(null);
      }
    }
  }, [workflow.operations, selectedPath]);

  const selectedOperation = useMemo(
    () => getOperationAtPath(workflow.operations, selectedPath),
    [workflow.operations, selectedPath]
  );

  const updateWorkflowOperations = (operations: CommandeurOperation[]) => {
    onWorkflowChange({ ...workflow, operations });
  };

  const updateSelectedOperation = (
    updater: (operation: CommandeurOperation) => CommandeurOperation
  ) => {
    if (!selectedPath) return;
    const updated = replaceOperationAtPath(
      workflow.operations,
      selectedPath,
      updater
    );
    if (updated !== workflow.operations) {
      updateWorkflowOperations(updated);
    }
  };

  const handleAddRootOperation = (kind: CommandeurOperationKind) => {
    const op = createOperation(kind);
    updateWorkflowOperations([...workflow.operations, op]);
    setSelectedPath([workflow.operations.length]);
  };

  const handleDuplicateOperation = (path: OperationPath) => {
    const op = getOperationAtPath(workflow.operations, path);
    if (!op) return;
    const clone = cloneOperationWithNewIds(op);
    const updated = insertOperationAt(
      workflow.operations,
      path,
      clone,
      "after"
    );
    updateWorkflowOperations(updated);
  };

  const handleRemoveOperation = (path: OperationPath) => {
    const updated = removeOperationAtPath(workflow.operations, path);
    updateWorkflowOperations(updated);
    if (selectedPath && JSON.stringify(selectedPath) === JSON.stringify(path)) {
      setSelectedPath(null);
    }
  };

  const handleMoveOperation = (
    path: OperationPath,
    direction: "up" | "down"
  ) => {
    const updated = moveOperation(workflow.operations, path, direction);
    updateWorkflowOperations(updated);
  };

  const handleAddChild = (
    path: OperationPath,
    branch: OperationBranchKey,
    kind: CommandeurOperationKind
  ) => {
    const child = createOperation(kind);
    const parentOperation = getOperationAtPath(workflow.operations, path);
    if (!parentOperation || parentOperation.kind !== "if") return;
    const branchOpsBefore =
      branch === "then" ? parentOperation.then : parentOperation.else ?? [];
    const newIndex = branchOpsBefore.length;
    const updated = replaceOperationAtPath(
      workflow.operations,
      path,
      (operation) => {
        if (operation.kind !== "if") return operation;
        const branchOps =
          branch === "then" ? operation.then : operation.else ?? [];
        const nextBranch = [...branchOps, child];
        return branch === "then"
          ? { ...operation, then: nextBranch }
          : { ...operation, else: nextBranch };
      }
    );
    updateWorkflowOperations(updated);
    setSelectedPath([...path, branch, newIndex]);
  };

  const renderOperationList = (
    operations: CommandeurOperation[],
    prefix: OperationPath = [],
    depth = 0
  ): React.ReactNode => {
    if (!operations.length) {
      return (
        <div style={workflowEditorStyles.placeholder}>
          Aucun élément. Utilisez le menu « Ajouter » pour démarrer.
        </div>
      );
    }
    return (
      <div style={workflowEditorStyles.list}>
        {operations.map((operation, index) => {
          const path = [...prefix, index];
          const active =
            selectedPath &&
            JSON.stringify(selectedPath) === JSON.stringify(path);
          return (
            <div
              key={operation.id}
              style={workflowEditorStyles.listItem(!!active)}
              onClick={() => setSelectedPath(path)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setSelectedPath(path);
                }
              }}
            >
              <div style={workflowEditorStyles.listItemHeader}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {operation.label || "(Sans nom)"}
                  </div>
                  <div style={workflowEditorStyles.listItemMeta}>
                    <span>{operationKindLabels[operation.kind]}</span>
                    {operation.enabled === false && <span>Désactivée</span>}
                  </div>
                </div>
                <div
                  style={workflowEditorStyles.listItemActions}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    className="btn"
                    onClick={() => handleMoveOperation(path, "up")}
                    disabled={index === 0}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleMoveOperation(path, "down")}
                    disabled={index === operations.length - 1}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    style={workflowEditorStyles.iconButton("default")}
                    onClick={() => handleDuplicateOperation(path)}
                    type="button"
                    title="Dupliquer cette opération"
                    aria-label="Dupliquer l'opération"
                  >
                    <span aria-hidden="true">⧉</span>
                  </button>
                  <button
                    style={workflowEditorStyles.iconButton("danger")}
                    onClick={() => handleRemoveOperation(path)}
                    type="button"
                    title="Supprimer cette opération"
                    aria-label="Supprimer l'opération"
                  >
                    <span aria-hidden="true">🗑️</span>
                  </button>
                </div>
              </div>

              {operation.kind === "if" && (
                <div style={workflowEditorStyles.listSecondary}>
                  {(["then", "else"] as OperationBranchKey[]).map((branch) => {
                    const label = branch === "then" ? "Alors" : "Sinon";
                    const branchOps =
                      branch === "then" ? operation.then : operation.else ?? [];
                    return (
                      <div
                        key={branch}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: ".4rem",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: ".8rem" }}>
                          {label}
                        </div>
                        {renderOperationList(
                          branchOps,
                          [...path, branch],
                          depth + 1
                        )}
                        <AddOperationControl
                          label={`Ajouter dans ${label.toLowerCase()}`}
                          onAdd={(kind) => handleAddChild(path, branch, kind)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={workflowEditorStyles.container}>
      <div style={workflowEditorStyles.metaRow}>
        <div style={workflowEditorStyles.metaField}>
          <label style={workflowEditorStyles.label} htmlFor="workflow-name">
            Nom du workflow
          </label>
          <input
            id="workflow-name"
            style={workflowEditorStyles.metaInput}
            value={workflow.name}
            onChange={(event) =>
              onWorkflowChange({ ...workflow, name: event.target.value })
            }
            placeholder="Nom visible dans les validations"
          />
        </div>
        <div style={workflowEditorStyles.metaField}>
          <label style={workflowEditorStyles.label} htmlFor="workflow-version">
            Version
          </label>
          <input
            id="workflow-version"
            style={workflowEditorStyles.metaInput}
            value={workflow.version ?? ""}
            onChange={(event) =>
              onWorkflowChange({ ...workflow, version: event.target.value })
            }
            placeholder="1.0"
          />
        </div>
      </div>

      <div style={workflowEditorStyles.editorBody}>
        <aside style={workflowEditorStyles.listPane}>
          <div style={workflowEditorStyles.listHeader}>
            <h4 style={{ margin: 0 }}>Opérations</h4>
          </div>
          <AddOperationControl label="Ajouter" onAdd={handleAddRootOperation} />
          {renderOperationList(workflow.operations)}
        </aside>

        <section style={workflowEditorStyles.formPane}>
          {selectedOperation && selectedPath ? (
            <OperationForm
              operation={selectedOperation}
              onUpdate={updateSelectedOperation}
            />
          ) : (
            <div style={workflowEditorStyles.placeholder}>
              Sélectionnez une opération pour afficher son formulaire.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

interface AddOperationControlProps {
  label: string;
  onAdd: (kind: CommandeurOperationKind) => void;
}

const AddOperationControl: React.FC<AddOperationControlProps> = ({
  label,
  onAdd,
}) => {
  const [kind, setKind] = useState<CommandeurOperationKind>("create-file");
  return (
    <div style={workflowEditorStyles.addRow}>
      <select
        style={workflowEditorStyles.select}
        value={kind}
        onChange={(event) =>
          setKind(event.target.value as CommandeurOperationKind)
        }
      >
        {operationKindOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => onAdd(kind)}
        style={workflowEditorStyles.addButton}
      >
        {label}
      </button>
    </div>
  );
};

interface OperationFormProps {
  operation: CommandeurOperation;
  onUpdate: (
    updater: (operation: CommandeurOperation) => CommandeurOperation
  ) => void;
}

const OperationForm: React.FC<OperationFormProps> = ({
  operation,
  onUpdate,
}) => {
  const updateField = <K extends keyof CommandeurOperation>(
    key: K,
    value: CommandeurOperation[K]
  ) => {
    onUpdate((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateSpecific = (
    mutator: (operation: CommandeurOperation) => CommandeurOperation
  ) => onUpdate(mutator);

  return (
    <div style={workflowEditorStyles.formSection}>
      <div style={workflowEditorStyles.formGrid}>
        <div style={workflowEditorStyles.field}>
          <label style={workflowEditorStyles.label}>Type</label>
          <div style={workflowEditorStyles.readOnlyBadge}>
            {operationKindLabels[operation.kind]}
          </div>
          <span style={workflowEditorStyles.helperText}>
            Le type est défini lors de l'ajout d'une opération.
          </span>
        </div>
        <div style={workflowEditorStyles.field}>
          <label style={workflowEditorStyles.label}>Libellé</label>
          <input
            style={workflowEditorStyles.input}
            value={operation.label}
            onChange={(event) => updateField("label", event.target.value)}
          />
        </div>
        <div style={workflowEditorStyles.field}>
          <label style={workflowEditorStyles.label}>Commentaire</label>
          <textarea
            style={workflowEditorStyles.textarea}
            value={operation.comment ?? ""}
            onChange={(event) => updateField("comment", event.target.value)}
            placeholder="Note facultative pour contextualiser l'opération"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" as const }}>
        <label style={workflowEditorStyles.checkboxRow}>
          <input
            type="checkbox"
            checked={operation.enabled !== false}
            onChange={(event) => updateField("enabled", event.target.checked)}
            style={workflowEditorStyles.checkboxInput}
          />
          Activée
        </label>
        <label style={workflowEditorStyles.checkboxRow}>
          <input
            type="checkbox"
            checked={operation.continueOnError === true}
            onChange={(event) =>
              updateField("continueOnError", event.target.checked)
            }
            style={workflowEditorStyles.checkboxInput}
          />
          Continuer en cas d'erreur
        </label>
      </div>

      <SpecificFields operation={operation} onUpdate={updateSpecific} />
    </div>
  );
};

interface SpecificFieldsProps {
  operation: CommandeurOperation;
  onUpdate: (
    mutator: (operation: CommandeurOperation) => CommandeurOperation
  ) => void;
}

const SpecificFields: React.FC<SpecificFieldsProps> = ({
  operation,
  onUpdate,
}) => {
  switch (operation.kind) {
    case "create-file":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Chemin cible"
            value={operation.target}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "create-file"
                  ? { ...current, target: value }
                  : current
              )
            }
          />
          <Field
            label="Contenu"
            value={operation.content}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "create-file"
                  ? { ...current, content: value }
                  : current
              )
            }
            multiline
          />
          <CheckboxField
            label="Écraser si le fichier existe"
            checked={operation.overwrite}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "create-file"
                  ? { ...current, overwrite: checked }
                  : current
              )
            }
          />
        </div>
      );
    case "delete-file":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Chemin cible"
            value={operation.target}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "delete-file"
                  ? { ...current, target: value }
                  : current
              )
            }
          />
          <CheckboxField
            label="Considérer comme erreur si le fichier est absent"
            checked={operation.required}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "delete-file"
                  ? { ...current, required: checked }
                  : current
              )
            }
          />
        </div>
      );
    case "copy":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Source"
            value={operation.source}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "copy"
                  ? { ...current, source: value }
                  : current
              )
            }
          />
          <Field
            label="Destination"
            value={operation.destination}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "copy"
                  ? { ...current, destination: value }
                  : current
              )
            }
          />
          <CheckboxField
            label="Écraser si la destination existe"
            checked={operation.overwrite}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "copy"
                  ? { ...current, overwrite: checked }
                  : current
              )
            }
          />
        </div>
      );
    case "exec":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Commande"
            value={operation.command}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "exec"
                  ? { ...current, command: value }
                  : current
              )
            }
          />
          <Field
            label="Arguments (un par ligne)"
            value={operation.args.join("\n")}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "exec"
                  ? { ...current, args: value.split(/\r?\n/).filter(Boolean) }
                  : current
              )
            }
            multiline
          />
          <Field
            label="Dossier de travail (optionnel)"
            value={operation.cwd ?? ""}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "exec"
                  ? { ...current, cwd: value || undefined }
                  : current
              )
            }
          />
          <div style={workflowEditorStyles.field}>
            <label style={workflowEditorStyles.label}>Shell</label>
            <select
              style={workflowEditorStyles.input}
              value={operation.shell}
              onChange={(event) =>
                onUpdate((current) =>
                  current.kind === "exec"
                    ? {
                        ...current,
                        shell: event.target.value as typeof operation.shell,
                      }
                    : current
                )
              }
            >
              <option value="default">Système</option>
              <option value="bash">Bash</option>
              <option value="zsh">Zsh</option>
              <option value="powershell">PowerShell</option>
            </select>
          </div>
          <Field
            label="Variables d'environnement (clé=valeur, une par ligne)"
            value={
              operation.env
                ? Object.entries(operation.env)
                    .map(([key, value]) => `${key}=${value}`)
                    .join("\n")
                : ""
            }
            onChange={(value) =>
              onUpdate((current) => {
                if (current.kind !== "exec") return current;
                const lines = value
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean);
                if (!lines.length) {
                  const { env: _unusedEnv, ...rest } = current;
                  void _unusedEnv;
                  return rest as CommandeurOperation;
                }
                const envEntries: Record<string, string> = {};
                for (const line of lines) {
                  const [key, ...restParts] = line.split("=");
                  if (!key) continue;
                  envEntries[key.trim()] = restParts.join("=");
                }
                return { ...current, env: envEntries };
              })
            }
            multiline
          />
        </div>
      );
    case "replace-in-file":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Fichier cible"
            value={operation.target}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "replace-in-file"
                  ? { ...current, target: value }
                  : current
              )
            }
          />
          <Field
            label="Recherche"
            value={operation.search}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "replace-in-file"
                  ? { ...current, search: value }
                  : current
              )
            }
          />
          <Field
            label="Remplacement"
            value={operation.replace}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "replace-in-file"
                  ? { ...current, replace: value }
                  : current
              )
            }
            multiline
          />
          <div style={workflowEditorStyles.field}>
            <label style={workflowEditorStyles.label}>Mode</label>
            <select
              style={workflowEditorStyles.input}
              value={operation.mode}
              onChange={(event) =>
                onUpdate((current) =>
                  current.kind === "replace-in-file"
                    ? {
                        ...current,
                        mode: event.target.value as typeof operation.mode,
                      }
                    : current
                )
              }
            >
              <option value="plain">Texte brut</option>
              <option value="regex">Expression régulière</option>
            </select>
          </div>
          <Field
            label="Flags (optionnel)"
            value={operation.flags ?? ""}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "replace-in-file"
                  ? { ...current, flags: value || undefined }
                  : current
              )
            }
          />
          <CheckboxField
            label="Prévisualiser avant exécution"
            checked={operation.preview}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "replace-in-file"
                  ? { ...current, preview: checked }
                  : current
              )
            }
          />
        </div>
      );
    case "rename":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Cible"
            value={operation.target}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "rename"
                  ? { ...current, target: value }
                  : current
              )
            }
          />
          <div style={workflowEditorStyles.field}>
            <label style={workflowEditorStyles.label}>Mode</label>
            <select
              style={workflowEditorStyles.input}
              value={operation.mode}
              onChange={(event) =>
                onUpdate((current) =>
                  current.kind === "rename"
                    ? {
                        ...current,
                        mode: event.target.value as typeof operation.mode,
                      }
                    : current
                )
              }
            >
              <option value="suffix">Ajouter un suffixe</option>
              <option value="prefix">Ajouter un préfixe</option>
              <option value="change-extension">Changer l'extension</option>
              <option value="replace">Remplacer une portion</option>
            </select>
          </div>
          <Field
            label="Valeur"
            value={operation.value}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "rename"
                  ? { ...current, value: value }
                  : current
              )
            }
          />
          <Field
            label="Recherche (mode remplacer)"
            value={operation.search ?? ""}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "rename"
                  ? { ...current, search: value || undefined }
                  : current
              )
            }
          />
          <Field
            label="Remplacement (mode remplacer)"
            value={operation.replace ?? ""}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "rename"
                  ? { ...current, replace: value || undefined }
                  : current
              )
            }
          />
        </div>
      );
    case "move":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Source"
            value={operation.source}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "move"
                  ? { ...current, source: value }
                  : current
              )
            }
          />
          <Field
            label="Destination"
            value={operation.destination}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "move"
                  ? { ...current, destination: value }
                  : current
              )
            }
          />
          <CheckboxField
            label="Écraser si la destination existe"
            checked={operation.overwrite}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "move"
                  ? { ...current, overwrite: checked }
                  : current
              )
            }
          />
        </div>
      );
    case "mkdir":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Dossier"
            value={operation.target}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "mkdir"
                  ? { ...current, target: value }
                  : current
              )
            }
          />
          <CheckboxField
            label="Créer récursivement"
            checked={operation.recursive}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "mkdir"
                  ? { ...current, recursive: checked }
                  : current
              )
            }
          />
          <CheckboxField
            label="Ignorer si le dossier existe"
            checked={operation.skipIfExists}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "mkdir"
                  ? { ...current, skipIfExists: checked }
                  : current
              )
            }
          />
        </div>
      );
    case "python":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <div style={workflowEditorStyles.field}>
            <label style={workflowEditorStyles.label}>Mode d'exécution</label>
            <select
              style={workflowEditorStyles.input}
              value={operation.entry}
              onChange={(event) =>
                onUpdate((current) =>
                  current.kind === "python"
                    ? {
                        ...current,
                        entry: event.target.value as typeof operation.entry,
                      }
                    : current
                )
              }
            >
              <option value="inline">Script inline</option>
              <option value="file">Script depuis un fichier</option>
            </select>
          </div>
          {operation.entry === "inline" ? (
            <Field
              label="Script"
              value={operation.inlineScript ?? ""}
              onChange={(value) =>
                onUpdate((current) =>
                  current.kind === "python"
                    ? { ...current, inlineScript: value }
                    : current
                )
              }
              multiline
            />
          ) : (
            <Field
              label="Chemin du script"
              value={operation.scriptPath ?? ""}
              onChange={(value) =>
                onUpdate((current) =>
                  current.kind === "python"
                    ? { ...current, scriptPath: value || undefined }
                    : current
                )
              }
            />
          )}
          <CheckboxField
            label="Détecter automatiquement les dépendances"
            checked={operation.detectExternalImports}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "python"
                  ? { ...current, detectExternalImports: checked }
                  : current
              )
            }
          />
        </div>
      );
    case "if":
      return (
        <div style={workflowEditorStyles.formGrid}>
          <Field
            label="Chemin à tester"
            value={operation.test.exists}
            onChange={(value) =>
              onUpdate((current) =>
                current.kind === "if"
                  ? { ...current, test: { ...current.test, exists: value } }
                  : current
              )
            }
          />
          <CheckboxField
            label="Nier le résultat"
            checked={operation.test.negate === true}
            onChange={(checked) =>
              onUpdate((current) =>
                current.kind === "if"
                  ? {
                      ...current,
                      test: { ...current.test, negate: checked },
                    }
                  : current
              )
            }
          />
          <div style={workflowEditorStyles.helperText}>
            Les sous-opérations sont gérées dans le panneau de gauche.
          </div>
        </div>
      );
    default:
      return null;
  }
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, multiline }) => (
  <div style={workflowEditorStyles.field}>
    <label style={workflowEditorStyles.label}>{label}</label>
    {multiline ? (
      <textarea
        style={workflowEditorStyles.textarea}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    ) : (
      <input
        style={workflowEditorStyles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )}
  </div>
);

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({
  label,
  checked,
  onChange,
}) => (
  <label style={workflowEditorStyles.checkboxRow}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      style={workflowEditorStyles.checkboxInput}
    />
    {label}
  </label>
);

export default WorkflowEditor;
