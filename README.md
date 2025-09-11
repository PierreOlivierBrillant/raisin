# Raisin

Application React + TypeScript (Vite) permettant :

- de définir un modèle hiérarchique de dossiers/fichiers
- d’exporter / importer ce modèle en YAML
- d’analyser des archives ZIP (structure simulée pour l’instant)

## Scripts

```bash
npm run dev       # serveur de développement (HMR)
npm run build     # build production (pré-lint + tsc + vite)
npm run preview   # prévisualisation du build
npm run lint      # vérification ESLint
npm run lint:fix  # vérification + corrections automatiques
```

Le script `prebuild` lance automatiquement `npm run lint` avant le build.

## Linting

Configuration basée sur:

- @eslint/js (recommandé)
- typescript-eslint (config recommandée)
- react-hooks (recommended-latest)
- react-refresh (vite)

Améliorations possibles si besoin de règles plus strictes (type-aware) :

```js
// Exemple (extrait) pour eslint.config.js
// ...
// remplacer tseslint.configs.recommended par :
...tseslint.configs.recommendedTypeChecked,
// ou version stricte :
...tseslint.configs.strictTypeChecked,
// éventuellement stylistique :
...tseslint.configs.stylisticTypeChecked,
```

Veiller alors à ajouter `parserOptions.project` pointant vers `tsconfig.app.json` et `tsconfig.node.json`.

## Types

Barrel unique : `src/types/index.ts` (FileNode, HierarchyTemplate, CreateNodeOptions, YamlHierarchy, etc.).

## Logique du modèle

`TemplateEditor.logic.ts` contient les opérations pures :

- création / mise à jour / suppression de nœuds
- garantie de l’invariant racine (`ensureRootInvariant`)
- sérialisation / désérialisation YAML (`toYamlHierarchy`, `fromYamlHierarchy`)

## Pistes futures

- Tests unitaires sur la logique de hiérarchie
- Analyse réelle d’archives ZIP + scoring
- Internationalisation de l’UI
- Règles ESLint strict type-aware

## Licence

Projet privé (aucune licence explicite fournie pour l’instant).
