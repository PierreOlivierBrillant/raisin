use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::{Cursor, Read, Seek, Write},
    path::{Path, PathBuf},
};
use tauri::api::dialog::blocking::FileDialogBuilder;
use zip::{write::FileOptions, CompressionMethod, ZipArchive, ZipWriter};

use crate::zip_utils::is_zip_like;

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
pub fn generate_standardized_zip(
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
        for candidate in candidate_roots {
            let matches = collect_related(&virtual_files, &candidate);
            if !matches.is_empty() {
                related = matches;
                break;
            }
        }

        if related.is_empty() {
            eprintln!(
                "[generate_standardized_zip] Aucun fichier trouvé pour le projet racine {:?}",
                project_root
            );
            continue;
        }

        let effective_root = related
            .first()
            .map(|vf| vf.path.split('/').next().unwrap_or(""))
            .unwrap_or("");
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
