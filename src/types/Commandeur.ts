import { z } from "zod";

/**
 * Liste d'opérations supportées par Commandeur.
 * Chaque opération s'applique à un dossier étudiant (racine = sous-dossier de premier niveau du lot).
 */
export const CommandeurOperationKind = z.enum([
  "create-file",
  "delete-file",
  "copy",
  "exec",
  "replace-in-file",
  "rename",
  "move",
  "mkdir",
  "python",
  "if",
]);

export type CommandeurOperationKind = z.infer<typeof CommandeurOperationKind>;

export const PathFragmentSchema = z
  .string()
  .min(1, "Chemin requis")
  .regex(/^[^\\:*?"<>|]+$/u, {
    message:
      'Le chemin ne doit pas contenir de caractère invalide (\\, :, *, ?, " , <, >, |)',
  });

const BaseOperationSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, "Nom requis"),
  comment: z.string().optional(),
  enabled: z.boolean().default(true),
  kind: CommandeurOperationKind,
  continueOnError: z.boolean().default(false),
});

const CreateFileSchema = BaseOperationSchema.extend({
  kind: z.literal("create-file"),
  target: PathFragmentSchema,
  overwrite: z.boolean().default(false),
  content: z.string().default(""),
});

const DeleteFileSchema = BaseOperationSchema.extend({
  kind: z.literal("delete-file"),
  target: PathFragmentSchema,
  required: z.boolean().default(false),
});

const CopySchema = BaseOperationSchema.extend({
  kind: z.literal("copy"),
  source: PathFragmentSchema,
  destination: PathFragmentSchema,
  overwrite: z.boolean().default(false),
});

const ExecSchema = BaseOperationSchema.extend({
  kind: z.literal("exec"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  shell: z.enum(["default", "powershell", "bash", "zsh"]).default("default"),
  cwd: PathFragmentSchema.optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const ReplaceModeSchema = z.enum(["plain", "regex"]);

const ReplaceInFileSchema = BaseOperationSchema.extend({
  kind: z.literal("replace-in-file"),
  target: PathFragmentSchema,
  search: z.string().min(1),
  replace: z.string().default(""),
  mode: ReplaceModeSchema.default("plain"),
  flags: z.string().optional(),
  preview: z.boolean().default(true),
});

const RenameSchema = BaseOperationSchema.extend({
  kind: z.literal("rename"),
  target: PathFragmentSchema,
  mode: z.enum(["suffix", "prefix", "change-extension", "replace"]),
  value: z.string().min(1),
  search: z.string().optional(),
  replace: z.string().optional(),
});

const MoveSchema = BaseOperationSchema.extend({
  kind: z.literal("move"),
  source: PathFragmentSchema,
  destination: PathFragmentSchema,
  overwrite: z.boolean().default(false),
});

const MkdirSchema = BaseOperationSchema.extend({
  kind: z.literal("mkdir"),
  target: PathFragmentSchema,
  recursive: z.boolean().default(true),
  skipIfExists: z.boolean().default(true),
});

const PythonSchema = BaseOperationSchema.extend({
  kind: z.literal("python"),
  inlineScript: z.string().optional(),
  scriptPath: PathFragmentSchema.optional(),
  entry: z.enum(["inline", "file"]),
  detectExternalImports: z.boolean().default(true),
});

type CommandeurBaseOperation = z.infer<typeof BaseOperationSchema>;

export interface CommandeurConditionalOperation
  extends CommandeurBaseOperation {
  kind: "if";
  test: {
    exists: string;
    negate?: boolean;
  };
  then: CommandeurOperation[];
  else?: CommandeurOperation[];
}

const ConditionalSchema: z.ZodType<CommandeurConditionalOperation> =
  BaseOperationSchema.extend({
    kind: z.literal("if"),
    test: z.object({
      exists: PathFragmentSchema,
      negate: z.boolean().default(false),
    }),
    then: z.lazy(() => CommandeurOperationSchema.array()),
    else: z.lazy(() => CommandeurOperationSchema.array()).optional(),
  });

export const CommandeurOperationSchema: z.ZodType<CommandeurOperation> = z.lazy(
  () =>
    z.union([
      CreateFileSchema,
      DeleteFileSchema,
      CopySchema,
      ExecSchema,
      ReplaceInFileSchema,
      RenameSchema,
      MoveSchema,
      MkdirSchema,
      PythonSchema,
      ConditionalSchema,
    ])
);

export type CommandeurCreateFileOperation = z.infer<typeof CreateFileSchema>;
export type CommandeurDeleteFileOperation = z.infer<typeof DeleteFileSchema>;
export type CommandeurCopyOperation = z.infer<typeof CopySchema>;
export type CommandeurExecOperation = z.infer<typeof ExecSchema>;
export type CommandeurReplaceOperation = z.infer<typeof ReplaceInFileSchema>;
export type CommandeurRenameOperation = z.infer<typeof RenameSchema>;
export type CommandeurMoveOperation = z.infer<typeof MoveSchema>;
export type CommandeurMkdirOperation = z.infer<typeof MkdirSchema>;
export type CommandeurPythonOperation = z.infer<typeof PythonSchema>;
export type CommandeurOperation =
  | CommandeurCreateFileOperation
  | CommandeurDeleteFileOperation
  | CommandeurCopyOperation
  | CommandeurExecOperation
  | CommandeurReplaceOperation
  | CommandeurRenameOperation
  | CommandeurMoveOperation
  | CommandeurMkdirOperation
  | CommandeurPythonOperation
  | CommandeurConditionalOperation;

export const CommandeurWorkflowSchema = z.object({
  name: z.string().min(1, "Nom du workflow requis"),
  version: z.string().default("1.0"),
  operations: CommandeurOperationSchema.array(),
});

export type CommandeurWorkflow = z.infer<typeof CommandeurWorkflowSchema>;

export const CommandeurValidationLevel = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type CommandeurValidationLevel =
  (typeof CommandeurValidationLevel)[keyof typeof CommandeurValidationLevel];

export interface CommandeurValidationMessage {
  operationId: string;
  level: CommandeurValidationLevel;
  message: string;
  details?: string;
  folders?: string[];
}

export interface CommandeurExecutionLogEntry {
  timestamp: string; // ISO string
  operationId: string;
  operationLabel: string;
  message: string;
  level: CommandeurValidationLevel;
}

export interface CommandeurExecutionResult {
  success: boolean;
  operationsRun: number;
  logFilePath: string;
  logEntries: CommandeurExecutionLogEntry[];
  warnings: CommandeurValidationMessage[];
  errors: CommandeurValidationMessage[];
  outputArchivePath?: string;
}

export interface CommandeurWorkspaceSummary {
  workspaceId: string;
  mode: "zip" | "directory";
  sourcePath: string;
  extractedPath?: string;
  subFolders: string[];
}

export interface CommandeurValidationContext {
  workspace: CommandeurWorkspaceSummary | null;
  workflow: CommandeurWorkflow | null;
}
