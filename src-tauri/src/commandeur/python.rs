use anyhow::{anyhow, Result};
use std::process::Command;

pub const PYTHON_STDLIB_ALLOWLIST: &[&str] = &[
    "argparse",
    "collections",
    "contextlib",
    "csv",
    "datetime",
    "functools",
    "glob",
    "hashlib",
    "heapq",
    "io",
    "itertools",
    "json",
    "logging",
    "math",
    "os",
    "pathlib",
    "random",
    "re",
    "shutil",
    "statistics",
    "string",
    "subprocess",
    "sys",
    "tempfile",
    "textwrap",
    "time",
    "typing",
    "uuid",
];

pub struct ExecutionEnv {
    python_cmd: Option<String>,
}

impl ExecutionEnv {
    pub fn new() -> Self {
        Self { python_cmd: None }
    }

    pub fn ensure_python(&mut self) -> Result<String> {
        if let Some(cmd) = &self.python_cmd {
            return Ok(cmd.clone());
        }
        let cmd = detect_python_command()?;
        self.python_cmd = Some(cmd.clone());
        Ok(cmd)
    }
}

pub fn detect_python_command() -> Result<String> {
    #[cfg(target_os = "windows")]
    let candidates = ["python", "python3"];
    #[cfg(not(target_os = "windows"))]
    let candidates = ["python3", "python"];
    for cand in candidates {
        if let Ok(output) = Command::new(cand).arg("--version").output() {
            if output.status.success() {
                return Ok(cand.to_string());
            }
        }
    }
    Err(anyhow!(
        "Interpréteur Python introuvable (python ou python3)"
    ))
}

pub fn detect_external_python_modules(script: &str) -> Option<Vec<String>> {
    let mut modules = Vec::new();
    for line in script.lines() {
        let mut content = line.trim();
        if content.starts_with('#') || content.is_empty() {
            continue;
        }
        if let Some(idx) = content.find('#') {
            content = &content[..idx].trim();
        }
        if content.starts_with("import ") {
            let rest = content[7..].trim();
            if let Some(module) = rest.split_whitespace().next() {
                let name = module.split('.').next().unwrap_or(module).trim();
                if !name.is_empty() {
                    maybe_push(&mut modules, name);
                }
            }
        } else if content.starts_with("from ") {
            let rest = content[5..].trim();
            if let Some(module) = rest.split_whitespace().next() {
                let name = module.split('.').next().unwrap_or(module).trim();
                if !name.is_empty() {
                    maybe_push(&mut modules, name);
                }
            }
        }
    }
    Some(modules)
}

fn maybe_push(modules: &mut Vec<String>, name: &str) {
    if !PYTHON_STDLIB_ALLOWLIST
        .iter()
        .any(|allowed| allowed == &name)
        && !modules.iter().any(|entry| entry == name)
    {
        modules.push(name.to_string());
    }
}
