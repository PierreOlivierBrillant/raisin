use std::collections::HashMap;
use std::fs;
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tempfile::TempDir;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::CompressionMethod;

use crate::commandeur::errors::CommandeurError;
use crate::commandeur::models::{CommandeurExecutionLogEntry, CommandeurValidationMessage};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandeurWorkspaceSummary {
    pub workspace_id: String,
    pub mode: WorkspaceMode,
    pub source_path: String,
    pub extracted_path: Option<String>,
    pub sub_folders: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceMode {
    Zip,
    Directory,
}

pub struct WorkspaceHandle {
    pub id: String,
    pub mode: WorkspaceMode,
    pub source_path: PathBuf,
    pub root_path: PathBuf,
    pub extracted: Option<TempDir>,
    pub created_at: DateTime<Utc>,
    pub sub_folders: Vec<String>,
}

impl WorkspaceHandle {
    pub fn folder_absolute_path(&self, folder: &str) -> PathBuf {
        self.root_path.join(folder)
    }
}

#[derive(Default)]
pub struct AppState {
    workspaces: Mutex<HashMap<String, Arc<Mutex<WorkspaceHandle>>>>,
}

impl AppState {
    pub fn register_workspace(&self, handle: WorkspaceHandle) -> Result<()> {
        let mut guard = self
            .workspaces
            .lock()
            .map_err(|_| anyhow!("Impossible d'obtenir le verrou du state"))?;
        guard.insert(handle.id.clone(), Arc::new(Mutex::new(handle)));
        Ok(())
    }

    pub fn get_workspace(&self, workspace_id: &str) -> Result<Arc<Mutex<WorkspaceHandle>>> {
        let guard = self
            .workspaces
            .lock()
            .map_err(|_| anyhow!("Erreur de concurrence sur le state"))?;
        guard
            .get(workspace_id)
            .cloned()
            .ok_or_else(|| CommandeurError::WorkspaceNotFound.into())
    }

    #[allow(dead_code)]
    pub fn drop_workspace(&self, workspace_id: &str) -> Result<()> {
        let mut guard = self
            .workspaces
            .lock()
            .map_err(|_| anyhow!("Erreur de concurrence sur le state"))?;
        guard.remove(workspace_id);
        Ok(())
    }
}

pub fn prepare_workspace(state: &AppState, path: &str) -> Result<CommandeurWorkspaceSummary> {
    let path_buf = PathBuf::from(path);
    if !path_buf.exists() {
        return Err(anyhow!("Le chemin fourni n'existe pas"));
    }

    if path_buf.is_file() {
        return Err(anyhow!(
            "Seuls les dossiers sont supportés pour Commandeur."
        ));
    }

    let root_path = auto_descend_single_directory(&path_buf)?;
    let mode = WorkspaceMode::Directory;
    let extracted: Option<TempDir> = None;
    let source_path = path_buf.clone();

    let sub_folders = collect_first_level_directories(&root_path)?;
    if sub_folders.is_empty() {
        return Err(anyhow!(
            "Aucun sous-dossier de premier niveau détecté. Vérifiez la structure de votre lot."
        ));
    }

    let workspace_id = new_id();
    let summary = CommandeurWorkspaceSummary {
        workspace_id: workspace_id.clone(),
        mode: mode.clone(),
        source_path: source_path.to_string_lossy().to_string(),
        extracted_path: extracted
            .as_ref()
            .map(|dir| dir.path().to_string_lossy().to_string()),
        sub_folders: sub_folders.clone(),
    };

    let handle = WorkspaceHandle {
        id: workspace_id.clone(),
        mode,
        source_path,
    root_path,
        extracted,
        created_at: Utc::now(),
        sub_folders,
    };

    state.register_workspace(handle)?;

    Ok(summary)
}

pub fn auto_descend_single_directory(base: impl AsRef<Path>) -> Result<PathBuf> {
    let mut current = base.as_ref().to_path_buf();
    loop {
        let mut dirs = Vec::new();
        let mut has_files = false;
        for entry in fs::read_dir(&current)? {
            let entry = entry?;
            let meta = entry.metadata()?;
            if meta.is_dir() {
                dirs.push(entry.path());
            } else {
                has_files = true;
            }
        }
        if dirs.len() == 1 && !has_files {
            current = dirs.remove(0);
            continue;
        }
        break Ok(current);
    }
}

pub fn collect_first_level_directories(root: &Path) -> Result<Vec<String>> {
    let mut dirs = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if meta.is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                dirs.push(name.to_string());
            }
        }
    }
    dirs.sort();
    Ok(dirs)
}

pub fn sanitize_relative_path(fragment: &str) -> Result<PathBuf> {
    let trimmed = fragment.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("Chemin vide"));
    }
    let normalized = trimmed.replace('\\', "/");
    let pb = PathBuf::from(&normalized);
    if pb.is_absolute() {
        return Err(anyhow!("Le chemin doit être relatif"));
    }
    for comp in pb.components() {
        if matches!(comp, Component::ParentDir) {
            return Err(anyhow!("Le chemin ne peut pas contenir '..'"));
        }
    }
    Ok(pb)
}

pub fn resolve_in_folder(folder_path: &Path, fragment: &str) -> Result<PathBuf> {
    let rel = sanitize_relative_path(fragment)?;
    Ok(folder_path.join(rel))
}

pub fn ensure_parent_dir(path: &Path) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }
    Ok(())
}

pub fn write_execution_log(
    workspace: &WorkspaceHandle,
    entries: &[CommandeurExecutionLogEntry],
    warnings: &[CommandeurValidationMessage],
    errors: &[CommandeurValidationMessage],
) -> Result<PathBuf> {
    let base_dir = workspace
        .source_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let logs_dir = base_dir.join("commandeur-logs");
    fs::create_dir_all(&logs_dir)?;
    let filename = format!("commandeur-log-{}.txt", Utc::now().format("%Y%m%d-%H%M%S"));
    let file_path = logs_dir.join(filename);
    let mut file = fs::File::create(&file_path)?;
    writeln!(file, "Raisin Commandeur - Journal d'exécution")?;
    writeln!(file, "Date: {}", Utc::now().to_rfc3339())?;
    writeln!(file, "Source: {}", workspace.source_path.display())?;
    writeln!(
        file,
        "Workspace créé: {}",
        workspace.created_at.to_rfc3339()
    )?;
    if let Some(extracted) = &workspace.extracted {
        writeln!(
            file,
            "Dossier temporaire: {}",
            extracted.path().to_string_lossy()
        )?;
    }
    writeln!(
        file,
        "Mode: {}",
        match workspace.mode {
            WorkspaceMode::Zip => "ZIP",
            WorkspaceMode::Directory => "Dossier",
        }
    )?;
    writeln!(file, "Sous-dossiers: {}", workspace.sub_folders.join(", "))?;
    writeln!(file, "")?;
    writeln!(file, "== Chronologie ==")?;
    for entry in entries {
        writeln!(
            file,
            "[{}][{}][{}] {}",
            entry.timestamp,
            entry.level_string(),
            entry.operation_label,
            entry.message
        )?;
    }
    if !warnings.is_empty() {
        writeln!(file, "")?;
        writeln!(file, "== Avertissements ==")?;
        for warn in warnings {
            writeln!(
                file,
                "- [{}] {} ({:?})",
                warn.operation_id,
                warn.message,
                warn.folders.as_ref().map(|f| f.join(", "))
            )?;
            if let Some(details) = &warn.details {
                writeln!(file, "    > {}", details)?;
            }
        }
    }
    if !errors.is_empty() {
        writeln!(file, "")?;
        writeln!(file, "== Erreurs ==")?;
        for err in errors {
            writeln!(
                file,
                "- [{}] {} ({:?})",
                err.operation_id,
                err.message,
                err.folders.as_ref().map(|f| f.join(", "))
            )?;
            if let Some(details) = &err.details {
                writeln!(file, "    > {}", details)?;
            }
        }
    }
    Ok(file_path)
}

pub fn repack_zip(workspace: &WorkspaceHandle) -> Result<PathBuf> {
    let source = &workspace.source_path;
    let parent = source
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("archive");
    let mut candidate = parent.join(format!("{}-commandeur.zip", stem));
    let mut idx = 1;
    while candidate.exists() {
        candidate = parent.join(format!("{}-commandeur-{}.zip", stem, idx));
        idx += 1;
    }

    let file = fs::File::create(&candidate)?;
    let mut writer = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    for entry in WalkDir::new(&workspace.root_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path == workspace.root_path {
            continue;
        }
        let relative = path.strip_prefix(&workspace.root_path).unwrap();
        let name = relative.to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            writer.add_directory(format!("{}/", name), options)?;
        } else {
            writer.start_file(name, options)?;
            let mut file = fs::File::open(path)?;
            io::copy(&mut file, &mut writer)?;
        }
    }

    writer.finish()?;
    Ok(candidate)
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}
