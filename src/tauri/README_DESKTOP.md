# Intégration Desktop (Tauri)

Ce dossier regroupera le code front spécifique d'intégration avec Tauri (adapters ZIP, helpers ipc).

Étapes suivantes (à exécuter en local):
1. Installer dépendances Tauri (Rust toolchain + cargo): https://tauri.app/v1/guides/getting-started/prerequisites
2. Initialiser Tauri: `npm run tauri:dev` (la première fois l'assistant init demandera des infos).
3. Configurer `tauri.conf.json` pour pointer `distDir` vers `dist` et `devPath` vers `http://localhost:5173`.
4. Implémenter un adapter `tauriZipReader` exposant `listEntries` via commande Rust.

A faire côté Rust (src-tauri/):
- Commande `list_entries(path: String)` retournant JSON { path, isDir, size }
- (Plus tard) `stream_entry(job_id, path)` -> events `zip:chunk` + `zip:done`/`zip:error`
- (Plus tard) `build_standardized_zip(spec_json)` -> chemin de sortie

Interfaces TypeScript disponibles dans `src/types/zip.ts`.
