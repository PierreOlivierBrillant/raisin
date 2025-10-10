use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::Command;

use anyhow::{anyhow, Result};

use crate::commandeur::errors::CommandeurError;
use crate::commandeur::models::{
    CommandeurExecutionLogEntry, CommandeurExecutionResult, CommandeurOperation,
    CommandeurValidationMessage, CommandeurWorkflow, OperationDetails, PythonEntry, ReplaceMode,
    ValidationLevel,
};
use crate::commandeur::python::ExecutionEnv;
use crate::commandeur::reporting::{
    push_folder_validation, push_log, push_log_with_meta, push_workspace_log,
};
use crate::commandeur::utils::{build_regex, compute_rename_destination};
use crate::commandeur::workspace::{
    ensure_parent_dir, repack_zip, resolve_in_folder, write_execution_log, AppState,
    WorkspaceHandle, WorkspaceMode,
};

pub fn execute_workflow(
    state: &AppState,
    workspace_id: &str,
    workflow: &CommandeurWorkflow,
) -> Result<CommandeurExecutionResult> {
    let workspace_arc = state.get_workspace(workspace_id)?;
    let workspace = workspace_arc
        .lock()
        .map_err(|_| anyhow!("Accès concurrent au workspace"))?;

    let mut env = ExecutionEnv::new();
    let mut log_entries = Vec::new();
    let mut warnings = Vec::new();
    let mut errors = Vec::new();
    let mut operations_run = 0usize;

    let workflow_banner = if let Some(version) = &workflow.version {
        format!(
            "Démarrage du workflow \"{}\" (version {})",
            workflow.name, version
        )
    } else {
        format!("Démarrage du workflow \"{}\"", workflow.name)
    };
    push_workspace_log(&mut log_entries, ValidationLevel::Info, workflow_banner);

    'folder_loop: for folder in &workspace.sub_folders {
        let base_path = workspace.folder_absolute_path(folder);
        if !base_path.exists() {
            push_workspace_log(
                &mut log_entries,
                ValidationLevel::Error,
                format!("Le dossier {folder} est introuvable"),
            );
            errors.push(CommandeurValidationMessage {
                operation_id: "__workspace__".into(),
                level: ValidationLevel::Error,
                message: format!("Le dossier {folder} est introuvable"),
                details: None,
                folders: Some(vec![folder.clone()]),
            });
            break 'folder_loop;
        }

        for operation in &workflow.operations {
            if !operation.enabled() {
                continue;
            }

            match execute_operation_for_folder(
                &workspace,
                operation,
                folder,
                &base_path,
                &mut env,
                &mut log_entries,
                &mut warnings,
            ) {
                Ok(()) => {
                    operations_run += 1;
                }
                Err(err) => match err {
                    CommandeurError::OperationFailed {
                        operation_id,
                        operation_label,
                        continue_on_error,
                        source,
                    } => {
                        let detail = source.to_string();
                        push_log_with_meta(
                            &mut log_entries,
                            &operation_id,
                            &operation_label,
                            ValidationLevel::Error,
                            format!("[{folder}] Échec: {detail}"),
                        );
                        errors.push(CommandeurValidationMessage {
                            operation_id: operation_id.clone(),
                            level: ValidationLevel::Error,
                            message: format!("Erreur lors de l'opération pour {folder}"),
                            details: Some(detail.clone()),
                            folders: Some(vec![folder.clone()]),
                        });
                        if !continue_on_error {
                            break 'folder_loop;
                        }
                    }
                    CommandeurError::WorkspaceNotFound => {
                        push_workspace_log(
                            &mut log_entries,
                            ValidationLevel::Error,
                            "Workspace introuvable pendant l'exécution",
                        );
                        break 'folder_loop;
                    }
                },
            }
        }
    }

    let log_file_path = write_execution_log(&workspace, &log_entries, &warnings, &errors)?;

    let output_archive_path = match workspace.mode {
        WorkspaceMode::Zip => Some(repack_zip(&workspace)?),
        WorkspaceMode::Directory => None,
    };

    let log_path_string = log_file_path.to_string_lossy().to_string();

    Ok(CommandeurExecutionResult {
        success: errors.is_empty(),
        operations_run,
        log_file_path: log_path_string,
        log_entries,
        warnings,
        errors,
        output_archive_path: output_archive_path.map(|p| p.to_string_lossy().to_string()),
    })
}

fn execute_operation_for_folder(
    workspace: &WorkspaceHandle,
    operation: &CommandeurOperation,
    folder: &str,
    base_path: &Path,
    env: &mut ExecutionEnv,
    log_entries: &mut Vec<CommandeurExecutionLogEntry>,
    warnings: &mut Vec<CommandeurValidationMessage>,
) -> Result<(), CommandeurError> {
    if let Some(comment) = operation.comment() {
        push_log(
            log_entries,
            operation,
            ValidationLevel::Info,
            format!("[{folder}] Note: {comment}"),
        );
    }

    match &operation.details {
        OperationDetails::CreateFile {
            target,
            overwrite,
            content,
        } => {
            let target_path = resolve_in_folder(base_path, target)
                .map_err(|err| operation_failed(operation, err))?;
            ensure_parent_dir(&target_path).map_err(|err| operation_failed(operation, err))?;
            if target_path.exists() && !overwrite {
                push_folder_validation(
                    warnings,
                    operation,
                    folder,
                    ValidationLevel::Warning,
                    format!("[{folder}] Le fichier existe déjà, création ignorée"),
                    Some(target_path.display().to_string()),
                );
                push_log(
                    log_entries,
                    operation,
                    ValidationLevel::Info,
                    format!("[{folder}] Fichier existant conservé: {target}"),
                );
            } else {
                fs::write(&target_path, content).map_err(|err| operation_failed(operation, err))?;
                push_log(
                    log_entries,
                    operation,
                    ValidationLevel::Info,
                    format!("[{folder}] Fichier créé: {target}"),
                );
            }
        }
        OperationDetails::DeleteFile { target, required } => {
            let target_path = resolve_in_folder(base_path, target)
                .map_err(|err| operation_failed(operation, err))?;
            if !target_path.exists() {
                let message = format!("[{folder}] Fichier à supprimer introuvable: {target}");
                if *required {
                    push_folder_validation(
                        warnings,
                        operation,
                        folder,
                        ValidationLevel::Error,
                        message.clone(),
                        None,
                    );
                    return Err(operation_failed(
                        operation,
                        anyhow!("Suppression requise impossible: fichier introuvable"),
                    ));
                } else {
                    push_folder_validation(
                        warnings,
                        operation,
                        folder,
                        ValidationLevel::Warning,
                        message,
                        None,
                    );
                }
            } else {
                remove_path(&target_path).map_err(|err| operation_failed(operation, err))?;
                push_log(
                    log_entries,
                    operation,
                    ValidationLevel::Info,
                    format!("[{folder}] Fichier supprimé: {target}"),
                );
            }
        }
        OperationDetails::Copy {
            source,
            destination,
            overwrite,
        } => {
            let source_path = resolve_in_folder(base_path, source)
                .map_err(|err| operation_failed(operation, err))?;
            if !source_path.exists() {
                return Err(operation_failed(
                    operation,
                    anyhow!("Source introuvable: {}", source_path.display()),
                ));
            }
            if source_path.is_dir() {
                return Err(operation_failed(
                    operation,
                    anyhow!("La copie de dossiers n'est pas supportée"),
                ));
            }
            let dest_path = resolve_in_folder(base_path, destination)
                .map_err(|err| operation_failed(operation, err))?;
            ensure_parent_dir(&dest_path).map_err(|err| operation_failed(operation, err))?;
            if dest_path.exists() {
                if *overwrite {
                    remove_path(&dest_path).map_err(|err| operation_failed(operation, err))?;
                } else {
                    return Err(operation_failed(
                        operation,
                        anyhow!("La destination existe déjà: {}", dest_path.display()),
                    ));
                }
            }
            fs::copy(&source_path, &dest_path).map_err(|err| operation_failed(operation, err))?;
            push_log(
                log_entries,
                operation,
                ValidationLevel::Info,
                format!(
                    "[{folder}] Fichier copié de {} vers {}",
                    source, destination
                ),
            );
        }
        OperationDetails::Exec {
            command,
            args,
            shell,
            cwd,
            env: custom_env,
        } => {
            let mut cmd = build_command(shell, command, args)
                .map_err(|err| operation_failed(operation, err))?;
            let cwd_path = if let Some(cwd_fragment) = cwd {
                resolve_in_folder(base_path, cwd_fragment)
                    .map_err(|err| operation_failed(operation, err))?
            } else {
                base_path.to_path_buf()
            };
            cmd.current_dir(&cwd_path);
            if let Some(env_map) = custom_env {
                cmd.envs(env_map.iter().map(|(k, v)| (k, v)));
            }
            let output = cmd
                .output()
                .map_err(|err| operation_failed(operation, err))?;
            if !output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(operation_failed(
                    operation,
                    anyhow!(
                        "Commande échouée (code: {:?})\nSTDOUT:\n{}\nSTDERR:\n{}",
                        output.status.code(),
                        stdout,
                        stderr
                    ),
                ));
            }
            push_log(
                log_entries,
                operation,
                ValidationLevel::Info,
                format!("[{folder}] Commande exécutée: {command}"),
            );
        }
        OperationDetails::ReplaceInFile {
            target,
            search,
            replace,
            mode,
            flags,
        } => {
            let target_path = resolve_in_folder(base_path, target)
                .map_err(|err| operation_failed(operation, err))?;
            if !target_path.exists() {
                return Err(operation_failed(
                    operation,
                    anyhow!("Fichier introuvable: {target}"),
                ));
            }
            let original =
                fs::read_to_string(&target_path).map_err(|err| operation_failed(operation, err))?;
            let (updated, count) = match mode {
                ReplaceMode::Plain => {
                    let occurrences = original.matches(search).count();
                    (original.replace(search, replace), occurrences)
                }
                ReplaceMode::Regex => {
                    let regex = build_regex(search, flags.as_deref())
                        .map_err(|err| operation_failed(operation, err))?;
                    let count = regex.find_iter(&original).count();
                    if count == 0 {
                        (original.clone(), 0)
                    } else {
                        (
                            regex.replace_all(&original, replace.as_str()).to_string(),
                            count,
                        )
                    }
                }
            };
            if count == 0 {
                push_folder_validation(
                    warnings,
                    operation,
                    folder,
                    ValidationLevel::Info,
                    format!("[{folder}] Aucun remplacement pour {target}"),
                    None,
                );
            } else {
                fs::write(&target_path, updated).map_err(|err| operation_failed(operation, err))?;
                push_log(
                    log_entries,
                    operation,
                    ValidationLevel::Info,
                    format!(
                        "[{folder}] {} occurrence(s) remplacée(s) dans {target}",
                        count
                    ),
                );
            }
        }
        OperationDetails::Rename {
            target,
            mode,
            value,
            search,
            replace,
        } => {
            let source_path = resolve_in_folder(base_path, target)
                .map_err(|err| operation_failed(operation, err))?;
            if !source_path.exists() {
                return Err(operation_failed(
                    operation,
                    anyhow!("Fichier ou dossier introuvable: {target}"),
                ));
            }
            let dest_path = compute_rename_destination(
                &source_path,
                mode,
                value,
                search.as_deref(),
                replace.as_deref(),
            )
            .map_err(|err| operation_failed(operation, err))?;
            if dest_path.exists() {
                return Err(operation_failed(
                    operation,
                    anyhow!("La destination existe déjà: {}", dest_path.display()),
                ));
            }
            ensure_parent_dir(&dest_path).map_err(|err| operation_failed(operation, err))?;
            fs::rename(&source_path, &dest_path).map_err(|err| operation_failed(operation, err))?;
            let dest_name = dest_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("?");
            push_log(
                log_entries,
                operation,
                ValidationLevel::Info,
                format!("[{folder}] Renommé {target} -> {dest_name}"),
            );
        }
        OperationDetails::Move {
            source,
            destination,
            overwrite,
        } => {
            let source_path = resolve_in_folder(base_path, source)
                .map_err(|err| operation_failed(operation, err))?;
            if !source_path.exists() {
                return Err(operation_failed(
                    operation,
                    anyhow!("Source introuvable: {source}"),
                ));
            }
            let dest_path = resolve_in_folder(base_path, destination)
                .map_err(|err| operation_failed(operation, err))?;
            ensure_parent_dir(&dest_path).map_err(|err| operation_failed(operation, err))?;
            if dest_path.exists() {
                if *overwrite {
                    remove_path(&dest_path).map_err(|err| operation_failed(operation, err))?;
                } else {
                    return Err(operation_failed(
                        operation,
                        anyhow!("Destination déjà existante: {destination}"),
                    ));
                }
            }
            fs::rename(&source_path, &dest_path).map_err(|err| operation_failed(operation, err))?;
            push_log(
                log_entries,
                operation,
                ValidationLevel::Info,
                format!("[{folder}] Déplacement {source} -> {destination}"),
            );
        }
        OperationDetails::Mkdir {
            target,
            recursive,
            skip_if_exists,
        } => {
            let target_path = resolve_in_folder(base_path, target)
                .map_err(|err| operation_failed(operation, err))?;
            if target_path.exists() {
                if *skip_if_exists {
                    push_folder_validation(
                        warnings,
                        operation,
                        folder,
                        ValidationLevel::Info,
                        format!("[{folder}] Dossier déjà présent: {target}"),
                        None,
                    );
                    return Ok(());
                }
            }
            if *recursive {
                fs::create_dir_all(&target_path).map_err(|err| operation_failed(operation, err))?;
            } else {
                fs::create_dir(&target_path).map_err(|err| operation_failed(operation, err))?;
            }
            push_log(
                log_entries,
                operation,
                ValidationLevel::Info,
                format!("[{folder}] Dossier créé: {target}"),
            );
        }
        OperationDetails::Python {
            inline_script,
            script_path,
            entry,
        } => {
            let interpreter = env
                .ensure_python()
                .map_err(|err| operation_failed(operation, err))?;
            let cwd_path = base_path;
            let mut temp_holder: Option<tempfile::NamedTempFile> = None;
            let script_fs_path = match entry {
                PythonEntry::Inline => {
                    let script = inline_script.as_ref().ok_or_else(|| {
                        operation_failed(operation, anyhow!("Script inline manquant"))
                    })?;
                    let mut file = tempfile::NamedTempFile::new()
                        .map_err(|err| operation_failed(operation, err))?;
                    file.write_all(script.as_bytes())
                        .map_err(|err| operation_failed(operation, err))?;
                    file.flush()
                        .map_err(|err| operation_failed(operation, err))?;
                    let path = file.path().to_path_buf();
                    temp_holder = Some(file);
                    path
                }
                PythonEntry::File => {
                    let fragment = script_path.as_ref().ok_or_else(|| {
                        operation_failed(operation, anyhow!("Chemin du script requis"))
                    })?;
                    resolve_in_folder(base_path, fragment)
                        .map_err(|err| operation_failed(operation, err))?
                }
            };

            if !script_fs_path.exists() {
                return Err(operation_failed(
                    operation,
                    anyhow!("Script Python introuvable: {}", script_fs_path.display()),
                ));
            }

            let output = Command::new(&interpreter)
                .arg(script_fs_path.as_os_str())
                .current_dir(cwd_path)
                .output()
                .map_err(|err| operation_failed(operation, err))?;
            drop(temp_holder);
            if !output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(operation_failed(
                    operation,
                    anyhow!(
                        "Script Python échoué (code: {:?})\nSTDOUT:\n{}\nSTDERR:\n{}",
                        output.status.code(),
                        stdout,
                        stderr
                    ),
                ));
            }
            push_log(
                log_entries,
                operation,
                ValidationLevel::Info,
                format!("[{folder}] Script Python exécuté"),
            );
        }
        OperationDetails::If {
            test,
            then,
            else_branch,
        } => {
            let condition_path = resolve_in_folder(base_path, &test.exists)
                .map_err(|err| operation_failed(operation, err))?;
            let exists = condition_path.exists();
            let condition = if test.negate { !exists } else { exists };
            let iter: Box<dyn Iterator<Item = &CommandeurOperation>> = if condition {
                Box::new(then.iter())
            } else {
                Box::new(else_branch.iter().flat_map(|ops| ops.iter()))
            };
            for child in iter {
                if !child.enabled() {
                    continue;
                }
                if let Err(err) = execute_operation_for_folder(
                    workspace,
                    child,
                    folder,
                    base_path,
                    env,
                    log_entries,
                    warnings,
                ) {
                    return Err(err);
                }
            }
            push_log(
                log_entries,
                operation,
                ValidationLevel::Info,
                format!(
                    "[{folder}] Condition {} -> {}",
                    test.exists,
                    if condition { "then" } else { "else" }
                ),
            );
        }
    }
    Ok(())
}

fn remove_path(path: &Path) -> std::io::Result<()> {
    if path.is_dir() {
        fs::remove_dir_all(path)
    } else if path.is_file() {
        fs::remove_file(path)
    } else {
        Ok(())
    }
}

fn build_command(
    shell: &crate::commandeur::models::ShellKind,
    command: &str,
    args: &[String],
) -> Result<Command, anyhow::Error> {
    use crate::commandeur::models::ShellKind;
    match shell {
        ShellKind::Default => {
            let mut cmd = Command::new(command);
            cmd.args(args);
            Ok(cmd)
        }
        ShellKind::Powershell => {
            #[cfg(target_os = "windows")]
            let shell_name = "powershell";
            #[cfg(not(target_os = "windows"))]
            let shell_name = "pwsh";
            let mut cmd = Command::new(shell_name);
            let script = join_powershell(command, args);
            cmd.arg("-NoProfile").arg("-Command").arg(script);
            Ok(cmd)
        }
        ShellKind::Bash => {
            let mut cmd = Command::new("bash");
            let script = if args.is_empty() {
                command.to_string()
            } else {
                format!("{} {}", command, join_shell_args(args))
            };
            cmd.arg("-lc").arg(script);
            Ok(cmd)
        }
        ShellKind::Zsh => {
            let mut cmd = Command::new("zsh");
            let script = if args.is_empty() {
                command.to_string()
            } else {
                format!("{} {}", command, join_shell_args(args))
            };
            cmd.arg("-lc").arg(script);
            Ok(cmd)
        }
    }
}

fn join_shell_args(args: &[String]) -> String {
    args.iter()
        .map(|arg| {
            if arg
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-_./".contains(c))
            {
                arg.clone()
            } else {
                format!("'{}'", arg.replace('\'', "'\\''"))
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn join_powershell(command: &str, args: &[String]) -> String {
    let mut parts = Vec::with_capacity(args.len() + 1);
    parts.push(command.to_string());
    for arg in args {
        if arg
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_./".contains(c))
        {
            parts.push(arg.clone());
        } else {
            parts.push(format!("'{}'", arg.replace('\'', "''")));
        }
    }
    parts.join(" ")
}

fn operation_failed(
    operation: &CommandeurOperation,
    err: impl Into<anyhow::Error>,
) -> CommandeurError {
    CommandeurError::OperationFailed {
        operation_id: operation.id().to_string(),
        operation_label: operation.label().to_string(),
        continue_on_error: operation.continue_on_error(),
        source: err.into(),
    }
}
