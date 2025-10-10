use std::fs;
use std::io::Write;
use std::path::PathBuf;

use anyhow::{Context, Result};
use chrono::Utc;

use crate::commandeur::models::{CommandeurWorkflow, SavedWorkflowSummary};
use crate::commandeur::storage;

#[derive(serde::Serialize, serde::Deserialize)]
struct StoredWorkflow {
    version: u32,
    id: String,
    name: String,
    saved_at: String,
    workflow: CommandeurWorkflow,
}

impl StoredWorkflow {
    fn new(id: String, name: String, workflow: CommandeurWorkflow) -> Self {
        Self {
            version: 1,
            id,
            name,
            saved_at: Utc::now().to_rfc3339(),
            workflow,
        }
    }

    fn summary(&self) -> SavedWorkflowSummary {
        SavedWorkflowSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            saved_at: self.saved_at.clone(),
        }
    }
}

fn workflow_file_path(id: &str) -> Result<PathBuf> {
    let dir = storage::workflows_dir()?;
    Ok(dir.join(format!("{}.json", id)))
}

pub fn save_workflow(workflow: &CommandeurWorkflow, existing_id: Option<String>) -> Result<SavedWorkflowSummary> {
    let id = if let Some(candidate) = existing_id {
        if workflow_file_path(&candidate)?.exists() {
            candidate
        } else {
            uuid::Uuid::new_v4().to_string()
        }
    } else {
        uuid::Uuid::new_v4().to_string()
    };

    let name = workflow.name.clone();
    let stored = StoredWorkflow::new(id.clone(), name, workflow.clone());
    let file_path = workflow_file_path(&id)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = fs::File::create(&file_path)?;
    let serialized = serde_json::to_string_pretty(&stored)?;
    file.write_all(serialized.as_bytes())?;
    file.sync_data()?;
    Ok(stored.summary())
}

fn read_stored_workflow(id: &str) -> Result<StoredWorkflow> {
    let file_path = workflow_file_path(id)?;
    let content = fs::read_to_string(&file_path).with_context(|| {
        format!("Impossible d'ouvrir le workflow sauvegardé {}", id)
    })?;
    let stored: StoredWorkflow = serde_json::from_str(&content).with_context(|| {
        format!("Impossible de parser le workflow sauvegardé {}", id)
    })?;
    Ok(stored)
}

pub fn list_workflows() -> Result<Vec<SavedWorkflowSummary>> {
    let dir = storage::workflows_dir()?;
    let mut summaries = Vec::new();
    if dir.exists() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            if entry.file_type()?.is_file() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                let content = fs::read_to_string(&path).with_context(|| {
                    format!("Impossible de lire le workflow sauvegardé {:?}", path)
                })?;
                let stored: StoredWorkflow = serde_json::from_str(&content).with_context(|| {
                    format!("Impossible d'analyser le workflow sauvegardé {:?}", path)
                })?;
                summaries.push(stored.summary());
            }
        }
    }
    summaries.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(summaries)
}

pub fn load_workflow(id: &str) -> Result<CommandeurWorkflow> {
    let stored = read_stored_workflow(id)?;
    Ok(stored.workflow)
}

pub fn delete_workflow(id: &str) -> Result<()> {
    let file_path = workflow_file_path(id)?;
    if file_path.exists() {
        fs::remove_file(&file_path)?;
    }
    Ok(())
}

pub fn duplicate_workflow(id: &str) -> Result<SavedWorkflowSummary> {
    let stored = read_stored_workflow(id)?;
    let mut workflow = stored.workflow.clone();
    let name = workflow.name.trim();
    if !name.is_empty() {
        workflow.name = format!("{} (copie)", name);
    }
    save_workflow(&workflow, None)
}
