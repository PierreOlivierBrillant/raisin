use anyhow::{anyhow, Result};
use regex::{Regex, RegexBuilder};
use std::path::{Path, PathBuf};

use crate::commandeur::models::RenameMode;

pub fn build_regex(pattern: &str, flags: Option<&str>) -> Result<Regex> {
    let mut builder = RegexBuilder::new(pattern);
    if let Some(flags) = flags {
        for ch in flags.chars() {
            match ch {
                'i' | 'I' => {
                    builder.case_insensitive(true);
                }
                'm' | 'M' => {
                    builder.multi_line(true);
                }
                's' | 'S' => {
                    builder.dot_matches_new_line(true);
                }
                'x' | 'X' => {
                    builder.ignore_whitespace(true);
                }
                'u' | 'U' => {
                    builder.unicode(true);
                }
                _ => {}
            }
        }
    }
    builder.build().map_err(|err| anyhow!(err))
}

pub fn compute_rename_destination(
    source_path: &Path,
    mode: &RenameMode,
    value: &str,
    search: Option<&str>,
    replace: Option<&str>,
) -> Result<PathBuf> {
    let file_name = source_path
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or_else(|| anyhow!("Nom de fichier invalide"))?;
    let parent = source_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    let trimmed_value = value.trim();
    if trimmed_value.is_empty() && !matches!(mode, RenameMode::Replace) {
        return Err(anyhow!("La valeur de renommage est vide"));
    }

    let new_name = match mode {
        RenameMode::Suffix => {
            if let Some((stem, ext)) = split_name_ext(file_name) {
                format!("{}{}{}", stem, trimmed_value, ext)
            } else {
                format!("{}{}", file_name, trimmed_value)
            }
        }
        RenameMode::Prefix => format!("{}{}", trimmed_value, file_name),
        RenameMode::ChangeExtension => {
            let new_ext = trimmed_value.trim_start_matches('.').trim();
            if new_ext.is_empty() {
                return Err(anyhow!("Extension cible vide"));
            }
            if let Some((stem, _)) = split_name_ext(file_name) {
                format!("{}.{}", stem, new_ext)
            } else {
                format!("{}.{}", file_name, new_ext)
            }
        }
        RenameMode::Replace => {
            let search = search.unwrap_or("");
            let replace_val = replace.unwrap_or(trimmed_value);
            if search.is_empty() {
                return Err(anyhow!("La chaîne à remplacer est vide"));
            }
            file_name.replace(search, replace_val)
        }
    };

    if new_name.trim().is_empty() {
        return Err(anyhow!("Le nouveau nom est vide"));
    }

    Ok(parent.join(new_name))
}

fn split_name_ext(name: &str) -> Option<(String, String)> {
    if let Some(idx) = name.rfind('.') {
        if idx == 0 {
            None
        } else {
            let stem = &name[..idx];
            let ext = &name[idx..];
            Some((stem.to_string(), ext.to_string()))
        }
    } else {
        None
    }
}
