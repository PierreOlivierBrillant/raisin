# Raisin

## Présentation rapide

- Analyse des remises étudiantes contenues dans une archive ZIP et évaluation face à un modèle cible.
- Ajustement manuel des chemins proposés avant la génération d’un ZIP « standardisé ».
- Version desktop (Tauri) incluant l’espace **Commandeur** pour exécuter des workflows automatisés sur un workspace local.

### Téléchargements (builds GitHub Actions)

- Windows (.msi) : [tauri-windows](https://nightly.link/PierreOlivierBrillant/raisin/workflows/tauri-build.yml/main/tauri-windows.zip)
- macOS Apple Silicon (.dmg/.app) : [tauri-macos-aarch64](https://nightly.link/PierreOlivierBrillant/raisin/workflows/tauri-build.yml/main/tauri-macos-aarch64.zip)
- macOS Intel (.dmg/.app) : [tauri-macos-x86_64](https://nightly.link/PierreOlivierBrillant/raisin/workflows/tauri-build.yml/main/tauri-macos-x86_64.zip)
- Linux (AppImage/deb) : [tauri-linux](https://nightly.link/PierreOlivierBrillant/raisin/workflows/tauri-build.yml/main/tauri-linux.zip)
- Arch Linux (AppImage) : [tauri-archlinux](https://nightly.link/PierreOlivierBrillant/raisin/workflows/tauri-build.yml/main/tauri-archlinux.zip)

### Parcours express

1. **Modèle** : créez ou importez votre structure attendue (YAML export/import).
2. **ZIP** : chargez l’archive contenant les dossiers étudiants.
3. **Paramètres** : choisissez le dossier racine, le nombre de projets et lancez l’analyse.
4. **Résultats** : consultez les scores (≥95 % vert, 90–94 % orange, <90 % rouge), corrigez les chemins et générez `standardized.zip`.

### Conseils clés

- Sauvegardez vos modèles via l’export YAML pour les réutiliser.
- Corrigez les chemins avant la génération pour normaliser les noms de projets.
- Les détails projet affichent les éléments correspondant ou manquants du modèle.
- L’espace Commandeur exécute des workflows YAML avec logs, mises en pause et gestion des erreurs.

---

## Environnement de développement

### Prérequis

- Node.js 20 (géré par `actions/setup-node` en CI).
- Rust toolchain stable (`cargo`, `rustup`).
- Pour Linux : `libgtk-3-dev`, `libayatana-appindicator3-dev`, `webkit2gtk-4.0`, `libwebkit2gtk-4.0-dev`, `libssl-dev`, `libappindicator3-dev`, `librsvg2-dev`.

### Installation

```bash
npm ci
```

### Commandes utiles

- `npm run dev` : interface web via Vite.
- `npm run tauri:dev` : application desktop (Tauri) avec auto-reload.
- `npm run lint` / `npm run lint:fix` : analyse et correction ESLint.
- `npm run test` : tests Vitest.
- `npm run tauri:build` : génère les exécutables desktop.

### Notes de projet

- Frontend : React 19 + Vite, styles CSS modulaires, validation avec Zod.
- Backend desktop : Tauri (Rust) pour l’accès disque, workflows Commandeur et génération d’archives.
- CI : workflow `Build Tauri Binaries` (GitHub Actions) produit les exécutables listés plus haut.
