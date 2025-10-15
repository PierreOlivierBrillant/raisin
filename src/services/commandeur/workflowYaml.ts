import yaml from "js-yaml";
import {
  CommandeurOperationSchema,
  CommandeurWorkflowSchema,
} from "../../types";
import type { CommandeurOperation, CommandeurWorkflow } from "../../types";

type YamlOperation = Omit<CommandeurOperation, "id"> & { id?: string };

type YamlWorkflow = Omit<CommandeurWorkflow, "operations"> & {
  operations: YamlOperation[];
};

function generateOperationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(
    36
  )}`;
}

function ensureOperationId(op: YamlOperation): CommandeurOperation {
  const withId = {
    ...op,
    id: op.id ?? generateOperationId(),
  } as CommandeurOperation;
  return CommandeurOperationSchema.parse(withId);
}

function ensureWorkflowIds(workflow: YamlWorkflow): CommandeurWorkflow {
  const normalized: CommandeurWorkflow = {
    name: workflow.name,
    version: workflow.version ?? "1.0",
    operations: workflow.operations.map(ensureOperationId),
  };
  return CommandeurWorkflowSchema.parse(normalized);
}

export function parseWorkflowYaml(source: string): CommandeurWorkflow {
  const raw = yaml.load(source);
  if (!raw || typeof raw !== "object") {
    throw new Error("Le fichier YAML est vide ou invalide");
  }
  return ensureWorkflowIds(raw as YamlWorkflow);
}

export function serializeWorkflowToYaml(workflow: CommandeurWorkflow): string {
  const payload: YamlWorkflow = {
    name: workflow.name,
    version: workflow.version,
    operations: workflow.operations.map((op) => ({
      ...op,
      id: op.id,
    })),
  };
  return yaml.dump(payload, { noRefs: true, indent: 2 });
}
