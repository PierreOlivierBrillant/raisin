// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commandeur;

use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    env, fs,
    io::{Cursor, Read, Seek, Write},
    path::{Path, PathBuf},
};
use tauri::api::dialog::blocking::FileDialogBuilder;
use zip::{write::FileOptions, CompressionMethod, ZipArchive, ZipWriter};

fn ensure_directory(path: &str, entries: &mut Vec<ZipEntryMeta>, added: &mut HashSet<String>) {
    if path.is_empty() {
        return;
    }
    if added.insert(path.to_string()) {
        entries.push(ZipEntryMeta {
            path: path.to_string(),
            is_dir: true,
            size: None,
        });
    }
}

fn ensure_parent_directories(
    path: &str,
    entries: &mut Vec<ZipEntryMeta>,
    added: &mut HashSet<String>,
) {
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() <= 1 {
        return;
    }
    let mut current = String::new();
    for part in &parts[..parts.len() - 1] {
        if part.is_empty() {
            continue;
        }
        if !current.is_empty() {
            current.push('/');
        }
        current.push_str(part);
        ensure_directory(&current, entries, added);
    }
}

fn is_zip_like(name: &str) -> bool {
    let trimmed = name.trim();
    let lower = trimmed.to_ascii_lowercase();
    lower.ends_with(".zip") || lower.ends_with(".zipx")
}

fn collect_zip_entries<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    prefix: &str,
    entries: &mut Vec<ZipEntryMeta>,
    added: &mut HashSet<String>,
) -> Result<(), String> {
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let clean = file.name().replace('\\', "/");
        if clean.is_empty() {
            continue;
        }
        let normalized = clean.trim_end_matches('/');
        if normalized.is_empty() && file.is_dir() {
            continue;
        }
        let full_path = if prefix.is_empty() {
            normalized.to_string()
        } else if normalized.is_empty() {
            prefix.trim_end_matches('/').to_string()
        } else {
            format!("{}{}", prefix, normalized)
        };

        if full_path.is_empty() {
            continue;
        }

        ensure_parent_directories(&full_path, entries, added);

        if file.is_dir() {
            ensure_directory(&full_path, entries, added);
            continue;
        }

        let is_nested_zip = full_path
            .split('/')
            .last()
            .map(is_zip_like)
            .unwrap_or_else(|| is_zip_like(&clean));

        if is_nested_zip {
            ensure_directory(&full_path, entries, added);
            let mut buffer = Vec::new();
            if let Err(err) = file.read_to_end(&mut buffer) {
                eprintln!(
                    "[collect_zip_entries] unable to read nested zip {:?}: {}",
                    full_path, err
                );
                continue;
            }
            let cursor = std::io::Cursor::new(buffer);
            match ZipArchive::new(cursor) {
                Ok(mut nested) => {
                    let nested_prefix = format!("{}/", full_path);
                    #[cfg(debug_assertions)]
                    {
                        eprintln!("[collect_zip_entries] expanding nested zip {:?}", full_path);
                    }
                    #[cfg(debug_assertions)]
                    let before = entries.len();
                    if let Err(err) =
                        collect_zip_entries(&mut nested, &nested_prefix, entries, added)
                    {
                        eprintln!(
                            "[collect_zip_entries] unable to traverse nested zip {:?}: {}",
                            full_path, err
                        );
                    } else {
                        #[cfg(debug_assertions)]
                        {
                            let added_count = entries.len().saturating_sub(before);
                            eprintln!(
                                "[collect_zip_entries] nested zip {:?} yielded {} entries",
                                full_path, added_count
                            );
                        }
                    }
                }
                Err(err) => {
                    eprintln!(
                        "[collect_zip_entries] unable to open nested zip {:?}: {}",
                        full_path, err
                    );
                }
            }
        } else if added.insert(full_path.clone()) {
            entries.push(ZipEntryMeta {
                path: full_path,
                is_dir: false,
                size: Some(file.size()),
            });
        }
    }
    Ok(())
}

#[derive(Clone)]
struct VirtualFile {
    path: String,
    data: Vec<u8>,
}

fn strip_zip_extension(name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".zipx") {
        name[..name.len().saturating_sub(5)].to_string()
    } else if lower.ends_with(".zip") {
        name[..name.len().saturating_sub(4)].to_string()
    } else {
        name.to_string()
    }
}

fn join_virtual_segments(prefix: &str, segments: &[&str]) -> String {
    let mut path = prefix.trim_matches('/').to_string();
    for segment in segments {
        if segment.is_empty() {
            continue;
        }
        if path.is_empty() {
            path.push_str(segment);
        } else {
            path.push('/');
            path.push_str(segment);
        }
    }
    path
}

fn normalize_zip_segments(path: &str) -> String {
    let segments: Vec<String> = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(strip_zip_extension)
        .collect();
    if segments.is_empty() {
        String::new()
    } else {
        segments.join("/")
    }
}

fn collect_virtual_files_from_zip<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    prefix: &str,
    out: &mut Vec<VirtualFile>,
) -> Result<(), String> {
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name_raw = file.name().replace('\\', "/");
        if name_raw.is_empty() {
            continue;
        }
        if file.is_dir() {
            continue;
        }
        let normalized = name_raw.trim_end_matches('/');
        if normalized.is_empty() {
            continue;
        }
        let segments: Vec<&str> = normalized.split('/').filter(|s| !s.is_empty()).collect();
        if segments.is_empty() {
            continue;
        }
        let file_name = segments.last().copied().unwrap_or("");
        if is_zip_like(file_name) {
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            let base_no_ext = strip_zip_extension(file_name);
            let parent_segments = if segments.len() > 1 {
                &segments[..segments.len() - 1]
            } else {
                &[][..]
            };
            let parent_prefix = join_virtual_segments(prefix, parent_segments);
            let next_prefix = if parent_prefix.is_empty() {
                base_no_ext.clone()
            } else if base_no_ext.is_empty() {
                parent_prefix.clone()
            } else {
                format!("{}/{}", parent_prefix, base_no_ext)
            };
            match ZipArchive::new(Cursor::new(buffer.clone())) {
                Ok(mut nested) => {
                    collect_virtual_files_from_zip(&mut nested, &next_prefix, out)?;
                }
                Err(err) => {
                    eprintln!(
                        "[generate_standardized_zip] unable to open nested zip {:?}: {}",
                        normalized, err
                    );
                    let full_path = join_virtual_segments(prefix, &segments);
                    out.push(VirtualFile {
                        path: full_path,
                        data: buffer,
                    });
                }
            }
            continue;
        }

        let mut data = Vec::new();
        file.read_to_end(&mut data).map_err(|e| e.to_string())?;
        let full_path = join_virtual_segments(prefix, &segments);
        out.push(VirtualFile {
            path: full_path,
            data,
        });
    }
    Ok(())
}

fn collect_virtual_files_from_directory(
    dir: &Path,
    out: &mut Vec<VirtualFile>,
) -> Result<(), String> {
    fn visit_directory(
        current: &Path,
        prefix: &str,
        out: &mut Vec<VirtualFile>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(current).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().replace('\\', "/");
            let next_prefix = if prefix.is_empty() {
                file_name.clone()
            } else {
                format!("{}/{}", prefix, file_name)
            };
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            if metadata.is_dir() {
                visit_directory(&entry_path, &next_prefix, out)?;
                continue;
            }

            if metadata.is_file() && is_zip_like(&file_name) {
                let mut buffer = Vec::new();
                fs::File::open(&entry_path)
                    .map_err(|e| e.to_string())?
                    .read_to_end(&mut buffer)
                    .map_err(|e| e.to_string())?;
                let no_ext = strip_zip_extension(&file_name);
                let nested_prefix = if prefix.is_empty() {
                    no_ext.clone()
                } else if no_ext.is_empty() {
                    prefix.to_string()
                } else {
                    format!("{}/{}", prefix, no_ext)
                };
                match ZipArchive::new(Cursor::new(buffer.clone())) {
                    Ok(mut nested) => {
                        collect_virtual_files_from_zip(&mut nested, &nested_prefix, out)?;
                    }
                    Err(err) => {
                        eprintln!(
                            "[generate_standardized_zip] unable to open nested zip file {:?}: {}",
                            entry_path, err
                        );
                        out.push(VirtualFile {
                            path: next_prefix,
                            data: buffer,
                        });
                    }
                }
                continue;
            }

            let mut data = Vec::new();
            fs::File::open(&entry_path)
                .map_err(|e| e.to_string())?
                .read_to_end(&mut data)
                .map_err(|e| e.to_string())?;
            out.push(VirtualFile {
                path: next_prefix,
                data,
            });
        }
        Ok(())
    }

    visit_directory(dir, "", out)
}

fn collect_virtual_files_from_source(path: &Path) -> Result<Vec<VirtualFile>, String> {
    let mut files = Vec::new();
    if path.is_file() {
        let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if !extension.to_ascii_lowercase().starts_with("zip") {
            return Err("Le fichier sélectionné n'est pas une archive ZIP".into());
        }
        let file = fs::File::open(path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        collect_virtual_files_from_zip(&mut archive, "", &mut files)?;
        return Ok(files);
    }

    if path.is_dir() {
        collect_virtual_files_from_directory(path, &mut files)?;
        return Ok(files);
    }

    Err("Le chemin source est introuvable".into())
}

fn collect_related<'a>(files: &'a [VirtualFile], root: &str) -> Vec<&'a VirtualFile> {
    if root.is_empty() {
        return files.iter().collect();
    }
    let prefix = format!("{}/", root);
    files
        .iter()
        .filter(|vf| vf.path == root || vf.path.starts_with(&prefix))
        .collect()
}

#[derive(Serialize)]
struct ZipEntryMeta {
    path: String,
    #[serde(rename = "isDir")] // compatibilité avec frontend existant
    is_dir: bool,
    size: Option<u64>,
}

#[derive(Deserialize)]
struct GenerationProjectPayload {
    #[serde(rename = "projectRootPath")]
    project_root_path: String,
    #[serde(rename = "newPath")]
    new_path: String,
}

#[derive(Deserialize)]
struct GenerationStudentPayload {
    projects: Vec<GenerationProjectPayload>,
}

#[derive(Deserialize)]
struct GenerationRequestPayload {
    #[serde(rename = "sourcePath")]
    source_path: String,
    students: Vec<GenerationStudentPayload>,
    #[serde(rename = "outputName")]
    output_name: Option<String>,
}

#[derive(Serialize)]
struct GenerationResponsePayload {
    #[serde(rename = "outputPath")]
    output_path: String,
}

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn list_entries(path: String) -> Result<Vec<ZipEntryMeta>, String> {
    let pb = PathBuf::from(&path);
    if !pb.exists() {
        return Err("Path does not exist".into());
    }
    // Si c'est un fichier ZIP => on lit son contenu (sans extraire) avec zip crate (support ZIP64)
    if pb.is_file()
        && pb
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("zip"))
            .unwrap_or(false)
    {
        let file = fs::File::open(&pb).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        let mut out: Vec<ZipEntryMeta> = Vec::new();
        let mut added: HashSet<String> = HashSet::new();
        collect_zip_entries(&mut archive, "", &mut out, &mut added)?;
        return Ok(out);
    }

    // Sinon: traiter comme dossier système ou fichier non-zip
    let mut out = Vec::new();
    let mut added: HashSet<String> = HashSet::new();

    if pb.is_dir() {
        let mut stack = vec![pb.clone()];
        while let Some(current_dir) = stack.pop() {
            let entries_iter = fs::read_dir(&current_dir).map_err(|e| e.to_string())?;
            for entry in entries_iter {
                let entry = match entry {
                    Ok(e) => e,
                    Err(err) => {
                        eprintln!("[list_entries] read_dir error: {err}");
                        continue;
                    }
                };
                let path = entry.path();
                let rel = match path.strip_prefix(&pb) {
                    Ok(rel) => rel,
                    Err(_) => continue,
                };
                let rel_str_raw = rel.to_string_lossy().replace('\\', "/");
                let rel_str = rel_str_raw.trim_end_matches('/');
                if rel_str.is_empty() {
                    continue;
                }

                let meta = match entry.metadata() {
                    Ok(m) => m,
                    Err(err) => {
                        eprintln!("[list_entries] metadata error for {:?}: {err}", path);
                        continue;
                    }
                };

                if meta.is_dir() {
                    ensure_parent_directories(rel_str, &mut out, &mut added);
                    ensure_directory(rel_str, &mut out, &mut added);
                    stack.push(path);
                    continue;
                }

                let is_zip = path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("zip"))
                    .unwrap_or(false);

                if is_zip {
                    ensure_parent_directories(rel_str, &mut out, &mut added);
                    ensure_directory(rel_str, &mut out, &mut added);
                    match fs::File::open(&path) {
                        Ok(file) => match ZipArchive::new(file) {
                            Ok(mut archive) => {
                                let nested_prefix = format!("{}/", rel_str);
                                if let Err(err) = collect_zip_entries(
                                    &mut archive,
                                    &nested_prefix,
                                    &mut out,
                                    &mut added,
                                ) {
                                    eprintln!(
                                        "[list_entries] nested zip processing failed for {:?}: {}",
                                        path, err
                                    );
                                }
                            }
                            Err(err) => {
                                eprintln!(
                                    "[list_entries] unable to open nested zip {:?}: {}",
                                    path, err
                                );
                                if added.insert(rel_str.to_string()) {
                                    out.push(ZipEntryMeta {
                                        path: rel_str.to_string(),
                                        is_dir: false,
                                        size: Some(meta.len()),
                                    });
                                }
                            }
                        },
                        Err(err) => {
                            eprintln!(
                                "[list_entries] unable to read nested zip {:?}: {}",
                                path, err
                            );
                            if added.insert(rel_str.to_string()) {
                                out.push(ZipEntryMeta {
                                    path: rel_str.to_string(),
                                    is_dir: false,
                                    size: Some(meta.len()),
                                });
                            }
                        }
                    }
                    continue;
                }

                ensure_parent_directories(rel_str, &mut out, &mut added);
                if added.insert(rel_str.to_string()) {
                    out.push(ZipEntryMeta {
                        path: rel_str.to_string(),
                        is_dir: false,
                        size: Some(meta.len()),
                    });
                }
            }
        }
    } else {
        // Fichier non-zip: retourner simple entrée
        let meta = fs::metadata(&pb).map_err(|e| e.to_string())?;
        let name = pb
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if !name.is_empty() {
            out.push(ZipEntryMeta {
                path: name,
                is_dir: false,
                size: Some(meta.len()),
            });
        }
    }

    Ok(out)
}

#[tauri::command]
fn generate_standardized_zip(
    payload: GenerationRequestPayload,
) -> Result<GenerationResponsePayload, String> {
    let source_path = PathBuf::from(&payload.source_path);
    let virtual_files = collect_virtual_files_from_source(&source_path)?;
    if virtual_files.is_empty() {
        return Err("Aucun fichier détecté dans la source sélectionnée.".into());
    }

    let mut projects: Vec<(String, String)> = Vec::new();
    for student in payload.students.iter() {
        for project in student.projects.iter() {
            let new_path = project.new_path.trim();
            if new_path.is_empty() {
                continue;
            }
            projects.push((
                project.project_root_path.trim_end_matches('/').to_string(),
                new_path.to_string(),
            ));
        }
    }

    if projects.is_empty() {
        return Err("Aucun projet à exporter.".into());
    }

    let default_name = payload
        .output_name
        .clone()
        .unwrap_or_else(|| "standardized.zip".to_string());

    let output_path = match FileDialogBuilder::new()
        .set_title("Enregistrer l'archive standardisée")
        .set_file_name(&default_name)
        .save_file()
    {
        Some(path) => path,
        None => return Err("CANCELLED".into()),
    };

    let file = fs::File::create(&output_path).map_err(|e| e.to_string())?;
    let mut zip_writer = ZipWriter::new(file);
    let file_options = FileOptions::default().compression_method(CompressionMethod::Deflated);
    let mut written_paths: HashSet<String> = HashSet::new();

    for (project_root, new_path) in projects {
        let root_clean = project_root.trim_matches('/');
        let mut candidate_roots = Vec::new();
        candidate_roots.push(root_clean.to_string());
        let normalized = normalize_zip_segments(root_clean);
        if normalized != root_clean {
            candidate_roots.push(normalized);
        }

        let mut related: Vec<&VirtualFile> = Vec::new();
        let mut effective_root = root_clean.to_string();
        for candidate in candidate_roots.iter() {
            let collected = collect_related(&virtual_files, candidate);
            if !collected.is_empty() {
                related = collected;
                effective_root = candidate.clone();
                break;
            }
        }

        if related.is_empty() {
            eprintln!(
                "[generate_standardized_zip] aucun fichier correspondant pour {:?}",
                project_root
            );
            continue;
        }

        let root_prefix = if effective_root.is_empty() {
            None
        } else {
            Some(format!("{}/", effective_root))
        };

        for vf in related {
            let relative = if let Some(prefix) = &root_prefix {
                if vf.path == effective_root {
                    String::new()
                } else if let Some(stripped) = vf.path.strip_prefix(prefix) {
                    stripped.to_string()
                } else {
                    vf.path.clone()
                }
            } else {
                vf.path.clone()
            };

            let dest_path = if relative.is_empty() {
                new_path.clone()
            } else {
                format!("{}/{}", new_path, relative)
            };

            if written_paths.insert(dest_path.clone()) {
                zip_writer
                    .start_file(dest_path.clone(), file_options.clone())
                    .map_err(|e| e.to_string())?;
                zip_writer.write_all(&vf.data).map_err(|e| e.to_string())?;
            }
        }
    }

    zip_writer.finish().map_err(|e| e.to_string())?;

    Ok(GenerationResponsePayload {
        output_path: output_path.to_string_lossy().into_owned(),
    })
}

#[cfg(target_os = "windows")]
fn collect_available_shells() -> Vec<String> {
    use std::path::PathBuf;

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
fn list_available_shells() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(collect_available_shells())
    }

    #[cfg(not(target_os = "windows"))]
    {
        collect_available_shells()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::io::{Cursor, Write};
    use zip::write::FileOptions;

    fn build_zip<F>(builder: F) -> Vec<u8>
    where
        F: FnOnce(&mut zip::ZipWriter<Cursor<Vec<u8>>>) -> zip::result::ZipResult<()>,
    {
        let cursor = Cursor::new(Vec::new());
        let mut writer = zip::ZipWriter::new(cursor);
        builder(&mut writer).expect("failed to build zip archive");
        writer
            .finish()
            .expect("failed to finalize zip archive")
            .into_inner()
    }

    #[test]
    fn root_level_files_are_reported_without_leading_slash() {
        let data = build_zip(|writer| {
            let options = FileOptions::default();
            writer.start_file("settings.gradle", options)?;
            writer.write_all(b"")?;
            writer.start_file("build.gradle", options)?;
            writer.write_all(b"")?;
            writer.start_file("gradle.properties", options)?;
            writer.write_all(b"")?;
            Ok(())
        });

        let cursor = Cursor::new(data);
        let mut archive = ZipArchive::new(cursor).expect("zip archive");
        let mut entries = Vec::new();
        let mut added = HashSet::new();
        collect_zip_entries(&mut archive, "", &mut entries, &mut added).expect("collect entries");

        let paths: HashSet<_> = entries.iter().map(|e| e.path.clone()).collect();
        assert!(paths.contains("settings.gradle"));
        assert!(paths.contains("build.gradle"));
        assert!(paths.contains("gradle.properties"));
        assert!(!paths.contains("/settings.gradle"));
    }

    #[test]
    fn nested_zip_content_is_discovered() {
        let inner = build_zip(|writer| {
            let options = FileOptions::default();
            writer.start_file("folder/file.txt", options)?;
            writer.write_all(b"hello")?;
            Ok(())
        });

        let outer = build_zip(|writer| {
            let options = FileOptions::default();
            writer.start_file("projects/readme.md", options)?;
            writer.write_all(b"Readme")?;
            writer.start_file("projects/nested.zip", options)?;
            writer.write_all(&inner)?;
            Ok(())
        });

        let cursor = Cursor::new(outer);
        let mut archive = ZipArchive::new(cursor).expect("outer zip");
        let mut entries = Vec::new();
        let mut added = HashSet::new();
        collect_zip_entries(&mut archive, "", &mut entries, &mut added).expect("collect entries");

        let paths: HashSet<_> = entries.iter().map(|e| e.path.clone()).collect();
        assert!(paths.contains("projects/nested.zip"));
        assert!(paths.contains("projects/nested.zip/folder/file.txt"));
    }

    #[test]
    fn multi_level_nested_zip_content_is_discovered() {
        let level3 = build_zip(|writer| {
            let options = FileOptions::default();
            writer.add_directory("Intra/", options)?;
            writer.start_file("Intra/build.gradle", options)?;
            writer.write_all(b"apply plugin: 'java'")?;
            writer.start_file("Intra/settings.gradle", options)?;
            writer.write_all(b"rootProject.name = 'demo'")?;
            Ok(())
        });

        let level2 = build_zip(|writer| {
            let options = FileOptions::default();
            writer.start_file("nested/project.zip", options)?;
            writer.write_all(&level3)?;
            Ok(())
        });

        let level1 = build_zip(|writer| {
            let options = FileOptions::default();
            writer.start_file("1030/StudentOne.zip", options)?;
            writer.write_all(&level2)?;
            Ok(())
        });

        let cursor = Cursor::new(level1);
        let mut archive = ZipArchive::new(cursor).expect("outermost zip");
        let mut entries = Vec::new();
        let mut added = HashSet::new();
        collect_zip_entries(&mut archive, "", &mut entries, &mut added)
            .expect("collect multi-level");

        let paths: HashSet<_> = entries.iter().map(|e| e.path.clone()).collect();
        assert!(paths.contains("1030"));
        assert!(paths.contains("1030/StudentOne.zip"));
        assert!(paths.contains("1030/StudentOne.zip/nested"));
        assert!(paths.contains("1030/StudentOne.zip/nested/project.zip"));
        assert!(paths.contains("1030/StudentOne.zip/nested/project.zip/Intra/build.gradle"));
        assert!(paths.contains("1030/StudentOne.zip/nested/project.zip/Intra/settings.gradle"));
    }

    #[test]
    fn list_entries_returns_student_zip_contents() {
        let student_zip = build_zip(|writer| {
            let options = FileOptions::default();
            writer.start_file("settings.gradle", options)?;
            writer.write_all(b"rootProject.name='demo'")?;
            writer.start_file("build.gradle", options)?;
            writer.write_all(b"apply plugin: 'java'")?;
            writer.add_directory("src/main/java/", options)?;
            writer.start_file("src/main/java/App.java", options)?;
            writer.write_all(b"class App {}")?;
            Ok(())
        });

        let outer_zip = build_zip(|writer| {
            let options = FileOptions::default();
            writer.add_directory("1030/", options)?;
            writer.start_file("1030/StudentOne.zip", options)?;
            writer.write_all(&student_zip)?;
            Ok(())
        });

        let temp = tempfile::tempdir().expect("tempdir");
        let zip_path = temp.path().join("1030.zip");
        fs::write(&zip_path, outer_zip).expect("write outer zip");

        let entries = list_entries(zip_path.to_string_lossy().into_owned()).expect("entries");
        let paths: HashSet<_> = entries.iter().map(|e| e.path.as_str()).collect();

        assert!(paths.contains("1030"));
        assert!(paths.contains("1030/StudentOne.zip"));
        assert!(paths.contains("1030/StudentOne.zip/settings.gradle"));
        assert!(paths.contains("1030/StudentOne.zip/build.gradle"));
        assert!(paths.contains("1030/StudentOne.zip/src/main/java/App.java"));
    }

    #[test]
    fn directory_listing_recurses_and_expands_nested_zip_files() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        let root_folder = temp_dir.path().join("root");
        fs::create_dir(&root_folder).expect("create root");
        let student_dir = root_folder.join("1030");
        fs::create_dir(&student_dir).expect("create 1030");

        let student_zip_data = build_zip(|writer| {
            let options = FileOptions::default();
            writer.add_directory("Intra/", options)?;
            writer.start_file("Intra/build.gradle", options)?;
            writer.write_all(b"apply plugin: 'java'")?;
            Ok(())
        });

        let student_zip_path = student_dir.join("IntraAlexis.zip");
        fs::write(&student_zip_path, student_zip_data).expect("write student zip");

        let entries = list_entries(root_folder.to_string_lossy().into_owned()).expect("entries");
        let paths: HashSet<(String, bool)> =
            entries.iter().map(|e| (e.path.clone(), e.is_dir)).collect();

        assert!(paths.contains(&("1030".to_string(), true)));
        assert!(paths.contains(&("1030/IntraAlexis.zip".to_string(), true)));
        assert!(paths.contains(&("1030/IntraAlexis.zip/Intra".to_string(), true)));
        assert!(paths.contains(&("1030/IntraAlexis.zip/Intra/build.gradle".to_string(), false)));
    }
}

fn main() {
    tauri::Builder::default()
        .manage(commandeur::AppState::default())
        .invoke_handler(tauri::generate_handler![
            ping,
            list_entries,
            generate_standardized_zip,
            list_available_shells,
            commandeur::commandeur_prepare_workspace,
            commandeur::commandeur_validate_workflow,
            commandeur::commandeur_execute_workflow,
            commandeur::commandeur_execution_pause,
            commandeur::commandeur_execution_resume,
            commandeur::commandeur_execution_stop,
            commandeur::commandeur_list_saved_workflows,
            commandeur::commandeur_save_workflow,
            commandeur::commandeur_load_saved_workflow,
            commandeur::commandeur_delete_saved_workflow,
            commandeur::commandeur_duplicate_saved_workflow,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
