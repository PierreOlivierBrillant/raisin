use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    io::{Read, Seek},
    path::{Path, PathBuf},
};
use zip::ZipArchive;

use crate::zip_utils::is_zip_like;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipEntryMeta {
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    pub size: Option<u64>,
}

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

fn collect_zip_entries<R: Read + Seek>(
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
                    let before = entries.len();
                    if let Err(err) = collect_zip_entries(&mut nested, &nested_prefix, entries, added)
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

#[tauri::command]
pub fn list_entries(path: String) -> Result<Vec<ZipEntryMeta>, String> {
    let pb = PathBuf::from(&path);
    if !pb.exists() {
        return Err("Path does not exist".into());
    }

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

#[cfg(test)]
mod tests {
    use super::{collect_zip_entries, list_entries, ZipEntryMeta};
    use std::collections::HashSet;
    use std::io::{Cursor, Write};
    use tempfile::tempdir;
    use zip::{write::FileOptions, ZipArchive, ZipWriter};

    fn build_zip<F>(builder: F) -> Vec<u8>
    where
        F: FnOnce(&mut ZipWriter<Cursor<Vec<u8>>>) -> zip::result::ZipResult<()>,
    {
        let cursor = Cursor::new(Vec::new());
        let mut writer = ZipWriter::new(cursor);
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

        let temp = tempdir().expect("tempdir");
        let zip_path = temp.path().join("1030.zip");
        std::fs::write(&zip_path, outer_zip).expect("write outer zip");

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
        let temp_dir = tempdir().expect("tempdir");
        let root_folder = temp_dir.path().join("root");
        std::fs::create_dir(&root_folder).expect("create root");
        let student_dir = root_folder.join("1030");
        std::fs::create_dir(&student_dir).expect("create 1030");

        let student_zip_data = build_zip(|writer| {
            let options = FileOptions::default();
            writer.add_directory("Intra/", options)?;
            writer.start_file("Intra/build.gradle", options)?;
            writer.write_all(b"apply plugin: 'java'")?;
            Ok(())
        });

        let student_zip_path = student_dir.join("IntraAlexis.zip");
        std::fs::write(&student_zip_path, student_zip_data).expect("write student zip");

        let entries =
            list_entries(root_folder.to_string_lossy().into_owned()).expect("entries");
        let paths: HashSet<(String, bool)> =
            entries.iter().map(|e| (e.path.clone(), e.is_dir)).collect();

        assert!(paths.contains(&("1030".to_string(), true)));
        assert!(paths.contains(&("1030/IntraAlexis.zip".to_string(), true)));
        assert!(paths.contains(&("1030/IntraAlexis.zip/Intra".to_string(), true)));
        assert!(paths.contains(&(
            "1030/IntraAlexis.zip/Intra/build.gradle".to_string(),
            false
        )));
    }
}
