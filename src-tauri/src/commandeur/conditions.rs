use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use regex::Regex;
use walkdir::WalkDir;

use crate::commandeur::models::{
    ConditionOperator, ConditionScope, ConditionSelector, ConditionTest,
};
use crate::commandeur::workspace::resolve_in_folder;

#[derive(Debug, Clone)]
pub struct NormalizedConditionTest {
    pub selector: ConditionSelector,
    pub operator: ConditionOperator,
    pub scope: Option<ConditionScope>,
    pub pattern: Option<String>,
    pub value: Option<String>,
    pub negate: bool,
}

#[derive(Debug, Clone)]
pub struct ConditionEvaluation {
    pub result: bool,
    pub summary: String,
}

pub fn normalize_condition(test: &ConditionTest) -> NormalizedConditionTest {
    let selector = test.selector.unwrap_or(ConditionSelector::FileSearch);

    let default_operator = default_operator_for_selector(selector);
    let operator = test
        .operator
        .filter(|op| is_operator_allowed(selector, *op))
        .unwrap_or(default_operator);

    let legacy_exists = normalize_optional_string(&test.exists);
    let pattern = match selector {
        ConditionSelector::FileSearch | ConditionSelector::FileCount => test
            .pattern
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .or_else(|| legacy_exists.clone()),
        _ => test
            .pattern
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
    };

    let value = match selector {
        ConditionSelector::CurrentFolderName => Some(
            test.value
                .as_ref()
                .map(|s| s.to_string())
                .unwrap_or_else(String::new),
        ),
        ConditionSelector::FileCount => Some(
            test.value
                .as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "0".to_string()),
        ),
        _ => normalize_optional_string(&test.value),
    };

    let scope = match selector {
        ConditionSelector::FileSearch | ConditionSelector::FileCount => {
            Some(test.scope.unwrap_or(ConditionScope::CurrentFolder))
        }
        _ => None,
    };

    NormalizedConditionTest {
        selector,
        operator,
        scope,
        pattern,
        value,
        negate: test.negate,
    }
}

pub fn evaluate_condition_for_folder(
    base_path: &Path,
    folder: &str,
    test: &ConditionTest,
) -> Result<ConditionEvaluation> {
    let normalized = normalize_condition(test);
    match normalized.selector {
        ConditionSelector::CurrentFolderName => evaluate_current_folder(folder, &normalized),
        ConditionSelector::FileSearch => evaluate_file_search(base_path, &normalized),
        ConditionSelector::FileCount => evaluate_file_count(base_path, &normalized),
    }
}

fn evaluate_current_folder(
    folder: &str,
    normalized: &NormalizedConditionTest,
) -> Result<ConditionEvaluation> {
    let value = normalized.value.clone().unwrap_or_else(String::new);

    let raw_result = match normalized.operator {
        ConditionOperator::Equals => folder == value,
        ConditionOperator::Contains => folder.contains(&value),
        ConditionOperator::Regex => {
            if value.trim().is_empty() {
                false
            } else {
                let regex = build_regex(&value)?;
                regex.is_match(folder)
            }
        }
        _ => false,
    };

    let final_result = apply_negate(raw_result, normalized.negate);
    let summary = format!(
        "Nom du dossier ({}) {} \"{}\" => {}{}",
        folder,
        operator_phrase_for_folder(normalized.operator),
        value,
        truth_label(final_result),
        negate_suffix(normalized.negate),
    );

    Ok(ConditionEvaluation {
        result: final_result,
        summary,
    })
}

fn evaluate_file_search(
    base_path: &Path,
    normalized: &NormalizedConditionTest,
) -> Result<ConditionEvaluation> {
    let pattern = normalized
        .pattern
        .clone()
        .ok_or_else(|| anyhow!("Motif de recherche manquant"))?;
    let scope = normalized.scope.unwrap_or(ConditionScope::CurrentFolder);
    let matches = collect_matches(base_path, &pattern, scope)?;
    let raw_result = match normalized.operator {
        ConditionOperator::Exists => !matches.is_empty(),
        ConditionOperator::NotExists => matches.is_empty(),
        _ => false,
    };

    let final_result = apply_negate(raw_result, normalized.negate);
    let summary = format!(
        "Recherche de fichier \"{}\" (portée: {}) -> {} correspondance(s), résultat {}{}",
        pattern,
        scope_label(scope),
        matches.len(),
        truth_label(final_result),
        negate_suffix(normalized.negate),
    );

    Ok(ConditionEvaluation {
        result: final_result,
        summary,
    })
}

fn evaluate_file_count(
    base_path: &Path,
    normalized: &NormalizedConditionTest,
) -> Result<ConditionEvaluation> {
    let pattern = normalized
        .pattern
        .clone()
        .unwrap_or_else(|| "*".to_string());
    let scope = normalized.scope.unwrap_or(ConditionScope::CurrentFolder);
    let matches = collect_matches(base_path, &pattern, scope)?;
    let file_count = matches.iter().filter(|path| path.is_file()).count() as i64;

    let threshold_str = normalized.value.clone().unwrap_or_else(|| "0".to_string());
    let threshold: i64 = threshold_str
        .parse()
        .map_err(|_| anyhow!("Valeur de comparaison invalide: {}", threshold_str))?;

    let raw_result = match normalized.operator {
        ConditionOperator::Equals => file_count == threshold,
        ConditionOperator::GreaterThan => file_count > threshold,
        ConditionOperator::LessThan => file_count < threshold,
        _ => false,
    };

    let final_result = apply_negate(raw_result, normalized.negate);
    let summary = format!(
        "Nombre de fichiers \"{}\" (portée: {}) -> {}, comparé {} {}, résultat {}{}",
        pattern,
        scope_label(scope),
        file_count,
        operator_symbol(normalized.operator),
        threshold,
        truth_label(final_result),
        negate_suffix(normalized.negate),
    );

    Ok(ConditionEvaluation {
        result: final_result,
        summary,
    })
}

fn collect_matches(base_path: &Path, pattern: &str, scope: ConditionScope) -> Result<Vec<PathBuf>> {
    let normalized_pattern = pattern.replace('\\', "/");
    let has_wildcards = normalized_pattern.contains('*') || normalized_pattern.contains('?');

    if !has_wildcards {
        let target = resolve_in_folder(base_path, &normalized_pattern)?;
        if target.exists() {
            return Ok(vec![target]);
        }
        return Ok(Vec::new());
    }

    let regex = wildcard_to_regex(&normalized_pattern)?;
    let mut matches = Vec::new();
    let mut iterator = WalkDir::new(base_path).follow_links(false).into_iter();
    let max_depth = match scope {
        ConditionScope::CurrentFolder => depth_hint(&normalized_pattern),
        ConditionScope::Recursive => usize::MAX,
    };

    while let Some(entry) = iterator.next() {
        let entry = match entry {
            Ok(value) => value,
            Err(err) => return Err(anyhow!(err)),
        };
        let depth = entry.depth();
        if depth == 0 {
            continue;
        }
        if scope == ConditionScope::CurrentFolder && depth > max_depth {
            if entry.file_type().is_dir() {
                iterator.skip_current_dir();
            }
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(base_path)
            .map_err(|err| anyhow!(err))?;
        let rel_str = path_to_forward_string(rel);
        if regex.is_match(&rel_str) {
            matches.push(entry.into_path());
        }
    }

    Ok(matches)
}

fn wildcard_to_regex(pattern: &str) -> Result<Regex> {
    let mut regex = String::from("^");
    let mut literal = String::new();
    let mut chars = pattern.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '*' => {
                if !literal.is_empty() {
                    regex.push_str(&regex::escape(&literal));
                    literal.clear();
                }
                if matches!(chars.peek(), Some('*')) {
                    while matches!(chars.peek(), Some('*')) {
                        chars.next();
                    }
                    regex.push_str(".*");
                } else {
                    regex.push_str("[^/]*");
                }
            }
            '?' => {
                if !literal.is_empty() {
                    regex.push_str(&regex::escape(&literal));
                    literal.clear();
                }
                regex.push_str("[^/]");
            }
            '/' => {
                if !literal.is_empty() {
                    regex.push_str(&regex::escape(&literal));
                    literal.clear();
                }
                regex.push('/');
            }
            '\\' => {
                if !literal.is_empty() {
                    regex.push_str(&regex::escape(&literal));
                    literal.clear();
                }
                regex.push('/');
            }
            _ => literal.push(ch),
        }
    }

    if !literal.is_empty() {
        regex.push_str(&regex::escape(&literal));
    }

    regex.push('$');
    Regex::new(&regex).map_err(|err| anyhow!(err))
}

fn depth_hint(pattern: &str) -> usize {
    let cleaned = pattern.trim_matches('/');
    if cleaned.is_empty() {
        1
    } else {
        cleaned
            .split('/')
            .filter(|segment| !segment.is_empty())
            .count()
            .max(1)
    }
}

fn path_to_forward_string(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn default_operator_for_selector(selector: ConditionSelector) -> ConditionOperator {
    match selector {
        ConditionSelector::CurrentFolderName => ConditionOperator::Equals,
        ConditionSelector::FileSearch => ConditionOperator::Exists,
        ConditionSelector::FileCount => ConditionOperator::Equals,
    }
}

fn is_operator_allowed(selector: ConditionSelector, operator: ConditionOperator) -> bool {
    match selector {
        ConditionSelector::CurrentFolderName => matches!(
            operator,
            ConditionOperator::Equals | ConditionOperator::Contains | ConditionOperator::Regex
        ),
        ConditionSelector::FileSearch => matches!(
            operator,
            ConditionOperator::Exists | ConditionOperator::NotExists
        ),
        ConditionSelector::FileCount => matches!(
            operator,
            ConditionOperator::Equals
                | ConditionOperator::GreaterThan
                | ConditionOperator::LessThan
        ),
    }
}

fn operator_phrase_for_folder(operator: ConditionOperator) -> &'static str {
    match operator {
        ConditionOperator::Equals => "doit être égal à",
        ConditionOperator::Contains => "doit contenir",
        ConditionOperator::Regex => "doit correspondre à la regex",
        _ => "opérateur non supporté",
    }
}

fn scope_label(scope: ConditionScope) -> &'static str {
    match scope {
        ConditionScope::CurrentFolder => "dossier courant",
        ConditionScope::Recursive => "sous-dossiers inclus",
    }
}

fn operator_symbol(operator: ConditionOperator) -> &'static str {
    match operator {
        ConditionOperator::Equals => "=",
        ConditionOperator::GreaterThan => ">",
        ConditionOperator::LessThan => "<",
        _ => "?",
    }
}

fn truth_label(result: bool) -> &'static str {
    if result {
        "vrai"
    } else {
        "faux"
    }
}

fn negate_suffix(negate: bool) -> &'static str {
    if negate {
        " (inversion)"
    } else {
        ""
    }
}

fn normalize_optional_string(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn apply_negate(value: bool, negate: bool) -> bool {
    if negate {
        !value
    } else {
        value
    }
}

fn build_regex(pattern: &str) -> Result<Regex> {
    Regex::new(pattern).map_err(|err| anyhow!(err))
}
