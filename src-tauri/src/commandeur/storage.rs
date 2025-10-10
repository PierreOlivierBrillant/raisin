use std::env;
use std::fs;
use std::path::PathBuf;

use anyhow::Result;
use tauri::api::path::config_dir;

const APP_FOLDER: &str = "Raisin";
const MODULE_FOLDER: &str = "commandeur";
const LOGS_FOLDER: &str = "logs";
const WORKFLOWS_FOLDER: &str = "workflows";

fn base_dir() -> Result<PathBuf> {
    let mut dir = config_dir().unwrap_or_else(|| {
        env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });
    dir.push(APP_FOLDER);
    dir.push(MODULE_FOLDER);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn logs_dir() -> Result<PathBuf> {
    let mut dir = base_dir()?;
    dir.push(LOGS_FOLDER);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn workflows_dir() -> Result<PathBuf> {
    let mut dir = base_dir()?;
    dir.push(WORKFLOWS_FOLDER);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}
