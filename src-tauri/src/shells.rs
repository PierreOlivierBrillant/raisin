#[cfg(target_os = "windows")]
use std::collections::HashSet;
#[cfg(target_os = "windows")]
use std::env;
#[cfg(not(target_os = "windows"))]
use std::fs;
#[cfg(not(target_os = "windows"))]
use std::path::Path;
#[cfg(target_os = "windows")]
use std::path::PathBuf;

#[cfg(target_os = "windows")]
fn collect_available_shells() -> Vec<String> {
    let mut shells = Vec::new();
    let mut seen = HashSet::new();

    let mut push_unique = |value: String| {
        if value.is_empty() {
            return;
        }
        let key = value.to_ascii_lowercase();
        if seen.insert(key) {
            shells.push(value);
        }
    };

    if let Ok(comspec) = env::var("ComSpec") {
        push_unique(comspec);
    } else {
        push_unique(String::from(r"C:\Windows\System32\cmd.exe"));
    }

    if let Ok(system_root) = env::var("SystemRoot") {
        let powershell_path = PathBuf::from(&system_root)
            .join("System32")
            .join("WindowsPowerShell")
            .join("v1.0")
            .join("powershell.exe");
        push_unique(powershell_path.display().to_string());
    } else {
        push_unique(String::from("powershell.exe"));
    }

    push_unique(String::from("pwsh.exe"));

    shells
}

#[cfg(not(target_os = "windows"))]
fn collect_available_shells() -> Result<Vec<String>, String> {
    let path = Path::new("/etc/shells");
    let content = fs::read_to_string(path).unwrap_or_default();
    let mut shells: Vec<String> = content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| line.to_string())
        .collect();

    if shells.is_empty() {
        shells.push(String::from("/bin/sh"));
        shells.push(String::from("/bin/bash"));
    }

    Ok(shells)
}

#[tauri::command]
pub fn list_available_shells() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(collect_available_shells())
    }

    #[cfg(not(target_os = "windows"))]
    {
        collect_available_shells()
    }
}
