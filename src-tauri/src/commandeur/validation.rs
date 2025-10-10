use std::fs;

use anyhow::{anyhow, Result};

use crate::commandeur::models::{
    CommandeurOperation, CommandeurValidationMessage, CommandeurWorkflow, OperationDetails,
    PythonEntry, ReplaceMode, ValidationLevel,
};
use crate::commandeur::python::detect_external_python_modules;
use crate::commandeur::reporting::{push_folder_validation, push_validation};
use crate::commandeur::utils::{build_regex, compute_rename_destination};
use crate::commandeur::workspace::{resolve_in_folder, AppState, WorkspaceHandle};

pub fn validate_workflow(
    state: &AppState,
    workspace_id: &str,
    workflow: &CommandeurWorkflow,
) -> Result<Vec<CommandeurValidationMessage>> {
    let workspace = state.get_workspace(workspace_id)?;
    let guard = workspace
        .lock()
        .map_err(|_| anyhow!("Accès concurrent au workspace"))?;
    let mut messages = Vec::new();
    for operation in &workflow.operations {
        validate_operation(&guard, operation, &mut messages)?;
    }
    Ok(messages)
}

pub fn validate_operation(
    workspace: &WorkspaceHandle,
    operation: &CommandeurOperation,
    messages: &mut Vec<CommandeurValidationMessage>,
) -> Result<()> {
    match &operation.details {
        OperationDetails::CreateFile { target, .. } => {
            let mut missing = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match resolve_in_folder(&folder_path, target) {
                    Ok(target_path) => {
                        if let Some(parent) = target_path.parent() {
                            if !parent.exists() {
                                missing.push(folder.clone());
                            }
                        } else {
                            missing.push(folder.clone());
                        }
                    }
                    Err(err) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin de destination invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !missing.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "Le dossier de destination n'existe pas",
                    None,
                    Some(missing),
                );
            }
        }
        OperationDetails::DeleteFile { target, required } => {
            let mut missing = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match resolve_in_folder(&folder_path, target) {
                    Ok(target_path) => {
                        if !target_path.exists() {
                            missing.push(folder.clone());
                        }
                    }
                    Err(err) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin de fichier invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !missing.is_empty() {
                let level = if *required {
                    ValidationLevel::Error
                } else {
                    ValidationLevel::Warning
                };
                let details = if *required {
                    format!(
                        "L'opération \"{}\" (#{}) exige la présence du fichier \"{}\".",
                        operation.label(),
                        operation.id(),
                        target
                    )
                } else {
                    format!(
                        "Opération \"{}\" (#{}) – fichier attendu : {}.",
                        operation.label(),
                        operation.id(),
                        target
                    )
                };
                push_validation(
                    messages,
                    operation,
                    level,
                    format!(
                        "Fichier \"{}\" introuvable dans {} sous-dossier(s)",
                        target,
                        missing.len()
                    ),
                    Some(details),
                    Some(missing),
                );
            }
        }
        OperationDetails::Copy {
            source,
            destination,
            ..
        } => {
            let mut missing_source = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match (
                    resolve_in_folder(&folder_path, source),
                    resolve_in_folder(&folder_path, destination),
                ) {
                    (Ok(source_path), Ok(dest_path)) => {
                        if !source_path.exists() {
                            missing_source.push(folder.clone());
                        } else if let Some(parent) = dest_path.parent() {
                            if !parent.exists() {
                                push_validation(
                                    messages,
                                    operation,
                                    ValidationLevel::Warning,
                                    "Le dossier de destination sera créé automatiquement",
                                    Some(format!("{}", dest_path.display())),
                                    Some(vec![folder.clone()]),
                                );
                            }
                        }
                    }
                    (Err(err), _) | (_, Err(err)) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !missing_source.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "Le fichier source est introuvable",
                    None,
                    Some(missing_source),
                );
            }
        }
        OperationDetails::Exec { cwd, command, .. } => {
            if command.trim().is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "La commande à exécuter est vide",
                    None,
                    None,
                );
            }
            if let Some(cwd_fragment) = cwd {
                let mut missing = Vec::new();
                for folder in &workspace.sub_folders {
                    let folder_path = workspace.folder_absolute_path(folder);
                    match resolve_in_folder(&folder_path, cwd_fragment) {
                        Ok(cwd_path) => {
                            if !cwd_path.exists() {
                                missing.push(folder.clone());
                            }
                        }
                        Err(err) => {
                            push_validation(
                                messages,
                                operation,
                                ValidationLevel::Error,
                                "Chemin du répertoire de travail invalide",
                                Some(err.to_string()),
                                None,
                            );
                            return Ok(());
                        }
                    }
                }
                if !missing.is_empty() {
                    push_validation(
                        messages,
                        operation,
                        ValidationLevel::Error,
                        "Répertoire de travail introuvable",
                        None,
                        Some(missing),
                    );
                }
            }
        }
        OperationDetails::ReplaceInFile {
            target,
            search,
            mode,
            flags,
            ..
        } => {
            if search.trim().is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "La chaîne de recherche est vide",
                    None,
                    None,
                );
            }
            if matches!(mode, ReplaceMode::Regex) {
                if let Err(err) = build_regex(search, flags.as_deref()) {
                    push_validation(
                        messages,
                        operation,
                        ValidationLevel::Error,
                        "Expression régulière invalide",
                        Some(err.to_string()),
                        None,
                    );
                }
            }
            let mut missing = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match resolve_in_folder(&folder_path, target) {
                    Ok(target_path) => {
                        if !target_path.exists() {
                            missing.push(folder.clone());
                        }
                    }
                    Err(err) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin de fichier invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !missing.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "Fichier cible introuvable",
                    None,
                    Some(missing),
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
            let mut missing = Vec::new();
            let mut conflicts = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match resolve_in_folder(&folder_path, target) {
                    Ok(source_path) => {
                        if !source_path.exists() {
                            missing.push(folder.clone());
                        } else {
                            match compute_rename_destination(
                                &source_path,
                                mode,
                                value,
                                search.as_deref(),
                                replace.as_deref(),
                            ) {
                                Ok(dest_path) => {
                                    if dest_path.exists() {
                                        conflicts.push(folder.clone());
                                    }
                                }
                                Err(err) => {
                                    push_validation(
                                        messages,
                                        operation,
                                        ValidationLevel::Error,
                                        "Transformation de nom invalide",
                                        Some(err.to_string()),
                                        None,
                                    );
                                    return Ok(());
                                }
                            }
                        }
                    }
                    Err(err) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin de fichier invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !missing.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "Fichier à renommer introuvable",
                    None,
                    Some(missing),
                );
            }
            if !conflicts.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "Le nom de destination existe déjà",
                    None,
                    Some(conflicts),
                );
            }
        }
        OperationDetails::Move {
            source,
            destination,
            overwrite,
        } => {
            let mut missing = Vec::new();
            let mut conflicts = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match (
                    resolve_in_folder(&folder_path, source),
                    resolve_in_folder(&folder_path, destination),
                ) {
                    (Ok(source_path), Ok(dest_path)) => {
                        if !source_path.exists() {
                            missing.push(folder.clone());
                        } else if dest_path.exists() && !overwrite {
                            conflicts.push(folder.clone());
                        }
                    }
                    (Err(err), _) | (_, Err(err)) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !missing.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "Source introuvable",
                    None,
                    Some(missing),
                );
            }
            if !conflicts.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Error,
                    "La destination existe déjà",
                    None,
                    Some(conflicts),
                );
            }
        }
        OperationDetails::Mkdir {
            target,
            skip_if_exists,
            ..
        } => {
            let mut exists = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match resolve_in_folder(&folder_path, target) {
                    Ok(path) => {
                        if path.exists() && !skip_if_exists {
                            exists.push(folder.clone());
                        }
                    }
                    Err(err) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin de dossier invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !exists.is_empty() {
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Info,
                    "Le dossier existe déjà",
                    None,
                    Some(exists),
                );
            }
        }
        OperationDetails::Python {
            inline_script,
            script_path,
            entry,
        } => match entry {
            PythonEntry::Inline => {
                if inline_script
                    .as_ref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
                {
                    push_validation(
                        messages,
                        operation,
                        ValidationLevel::Error,
                        "Le script Python inline est vide",
                        None,
                        None,
                    );
                } else if let Some(script) = inline_script {
                    if let Some(externals) = detect_external_python_modules(script) {
                        if !externals.is_empty() {
                            push_validation(
                                messages,
                                operation,
                                ValidationLevel::Warning,
                                "Le script Python semble utiliser des modules externes non supportés",
                                Some(externals.join(", ")),
                                None,
                            );
                        }
                    }
                }
            }
            PythonEntry::File => {
                if script_path
                    .as_ref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
                {
                    push_validation(
                        messages,
                        operation,
                        ValidationLevel::Error,
                        "Le chemin du script Python est vide",
                        None,
                        None,
                    );
                } else {
                    let mut missing = Vec::new();
                    for folder in &workspace.sub_folders {
                        let folder_path = workspace.folder_absolute_path(folder);
                        match resolve_in_folder(&folder_path, script_path.as_ref().unwrap()) {
                            Ok(path) => {
                                if !path.exists() {
                                    missing.push(folder.clone());
                                } else if let Ok(content) = fs::read_to_string(&path) {
                                    if let Some(externals) =
                                        detect_external_python_modules(&content)
                                    {
                                        if !externals.is_empty() {
                                            push_folder_validation(
                                                messages,
                                                operation,
                                                folder,
                                                ValidationLevel::Warning,
                                                "Le script Python semble utiliser des modules externes non supportés",
                                                Some(externals.join(", ")),
                                            );
                                        }
                                    }
                                }
                            }
                            Err(err) => {
                                push_validation(
                                    messages,
                                    operation,
                                    ValidationLevel::Error,
                                    "Chemin du script Python invalide",
                                    Some(err.to_string()),
                                    None,
                                );
                                return Ok(());
                            }
                        }
                    }
                    if !missing.is_empty() {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Script Python introuvable",
                            None,
                            Some(missing),
                        );
                    }
                }
            }
        },
        OperationDetails::If {
            test,
            then,
            else_branch,
        } => {
            let mut missing = Vec::new();
            for folder in &workspace.sub_folders {
                let folder_path = workspace.folder_absolute_path(folder);
                match resolve_in_folder(&folder_path, &test.exists) {
                    Ok(path) => {
                        let exists = path.exists();
                        if exists == test.negate {
                            missing.push(folder.clone());
                        }
                    }
                    Err(err) => {
                        push_validation(
                            messages,
                            operation,
                            ValidationLevel::Error,
                            "Chemin de condition invalide",
                            Some(err.to_string()),
                            None,
                        );
                        return Ok(());
                    }
                }
            }
            if !missing.is_empty() {
                let msg = if test.negate {
                    "Le fichier existe alors qu'il ne devrait pas"
                } else {
                    "Le fichier de condition est absent"
                };
                push_validation(
                    messages,
                    operation,
                    ValidationLevel::Info,
                    msg,
                    None,
                    Some(missing),
                );
            }
            for child in then {
                validate_operation(workspace, child, messages)?;
            }
            if let Some(else_branch) = else_branch {
                for child in else_branch {
                    validate_operation(workspace, child, messages)?;
                }
            }
        }
    }
    Ok(())
}
