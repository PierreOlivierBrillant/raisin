// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{fs, path::PathBuf, collections::HashSet};
use tauri::State;
use zip::ZipArchive;

#[derive(Serialize)]
struct ZipEntryMeta {
  path: String,
  isDir: bool,
  size: Option<u64>,
}

struct AppState {}

#[tauri::command]
fn ping() -> &'static str { "pong" }

#[tauri::command]
fn list_entries(path: String) -> Result<Vec<ZipEntryMeta>, String> {
  let pb = PathBuf::from(&path);
  if !pb.exists() {
    return Err("Path does not exist".into());
  }
  // Si c'est un fichier ZIP => on lit son contenu (sans extraire) avec zip crate (support ZIP64)
  if pb.is_file() && pb.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("zip")).unwrap_or(false) {
    let file = fs::File::open(&pb).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut out: Vec<ZipEntryMeta> = Vec::with_capacity(archive.len());
    let mut dir_set: HashSet<String> = HashSet::new();

    for i in 0..archive.len() {
      let file = archive.by_index(i).map_err(|e| e.to_string())?;
      let raw_name = file.name();
      // Normalisation chemin
      let clean = raw_name.replace('\\', "/");
      let is_dir = file.is_dir();
      let name_no_trailing = clean.trim_end_matches('/').to_string();
      if !name_no_trailing.is_empty() {
        if is_dir { dir_set.insert(name_no_trailing.clone()); }
        else {
          // enregistrer parents
            let mut parts_iter = name_no_trailing.split('/').collect::<Vec<_>>();
            if parts_iter.len() > 1 { parts_iter.pop(); }
            for i in 0..parts_iter.len() { let d = parts_iter[0..=i].join("/"); dir_set.insert(d); }
        }
        out.push(ZipEntryMeta { path: name_no_trailing, isDir: is_dir, size: if is_dir { None } else { Some(file.size()) } });
      }
    }
    // Ajouter dossiers manquants (ceux qui n'étaient pas explicitement marqués directory dans l'archive)
    let existing_dirs: HashSet<&str> = out.iter().filter(|e| e.isDir).map(|e| e.path.as_str()).collect();
    for d in dir_set { if !existing_dirs.contains(d.as_str()) { out.push(ZipEntryMeta { path: d, isDir: true, size: None }); } }
    return Ok(out);
  }

  // Sinon: traiter comme dossier système (fallback)
  let mut out = Vec::new();
  if pb.is_dir() {
    let walker = fs::read_dir(&pb).map_err(|e| e.to_string())?;
    for entry in walker {
      if let Ok(e) = entry { 
        let meta = e.metadata().map_err(|e| e.to_string())?;
        let is_dir = meta.is_dir();
        let file_path = e.path();
        let rel = file_path.strip_prefix(&pb).unwrap_or(&file_path);
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if !rel_str.is_empty() {
          out.push(ZipEntryMeta { 
            path: rel_str.trim_end_matches('/').to_string(),
            isDir: is_dir,
            size: if is_dir { None } else { Some(meta.len()) }
          });
        }
      }
    }
  } else {
    // Fichier non-zip: retourner simple entrée
    let meta = fs::metadata(&pb).map_err(|e| e.to_string())?;
    out.push(ZipEntryMeta { path: pb.file_name().unwrap().to_string_lossy().into(), isDir: false, size: Some(meta.len()) });
  }
  Ok(out)
}

fn main() {
  tauri::Builder::default()
    .manage(AppState {})
    .invoke_handler(tauri::generate_handler![ping, list_entries])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
