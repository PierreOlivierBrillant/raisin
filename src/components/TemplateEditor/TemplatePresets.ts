// Définitions de presets d'arborescences pour différents frameworks / stacks.
// Chaque preset est une liste de chemins (relatifs à la racine) avec leur type.
import type { HierarchyTemplate, FileNode } from "../../types";
import { createNode, createDefaultTemplate } from "./TemplateEditor.logic";

export type PresetKey = "react" | "angular" | "vue" | "dotnet";

interface PresetEntry {
  path: string; // ex: "src/components" ou "src/App.tsx"
  type: FileNode["type"]; // directory | file
}

const reactPreset: PresetEntry[] = [
  { path: "src", type: "directory" },
  { path: "src/App.*sx", type: "file" },
  { path: "src/main.*sx", type: "file" },
  { path: "public", type: "directory" },
  { path: "package.json", type: "file" },
  { path: "tsconfig.json", type: "file" },
];

const angularPreset: PresetEntry[] = [
  { path: "src", type: "directory" },
  { path: "src/app", type: "directory" },
  { path: "src/app/app.component.ts", type: "file" },
  { path: "src/app/app.module.ts", type: "file" },
  { path: "angular.json", type: "file" },
  { path: "package.json", type: "file" },
  { path: "tsconfig.json", type: "file" },
];

const vuePreset: PresetEntry[] = [
  { path: "src", type: "directory" },
  { path: "src/App.vue", type: "file" },
  { path: "src/main.*s", type: "file" },
  { path: "index.html", type: "file" },
  { path: "package.json", type: "file" },
  { path: "tsconfig.json", type: "file" },
  { path: "vite.config.ts", type: "file" },
];

const dotnetPreset: PresetEntry[] = [
  { path: "*", type: "directory" },
  { path: "*/Program.cs", type: "file" },
  { path: "*/*.csproj", type: "file" },
  { path: "*.sln", type: "file" },
];

const PRESETS: Record<PresetKey, PresetEntry[]> = {
  react: reactPreset,
  angular: angularPreset,
  vue: vuePreset,
  dotnet: dotnetPreset,
};

/**
 * Construit un NOUVEAU template à partir d'un preset (remplacement total de l'arbre sauf racine).
 * Utile pour basculer rapidement entre frameworks (reset complet).
 */
export function buildPresetTemplate(key: PresetKey): HierarchyTemplate {
  const entries = PRESETS[key] || [];
  let work = createDefaultTemplate();
  const rootId = work.rootNodes[0];
  const cache = new Map<string, string>();
  cache.set("", rootId);

  function ensureDirectory(dirPath: string) {
    if (dirPath === "") return;
    if (cache.has(dirPath)) return;
    const parts = dirPath.split("/");
    let currentPath = "";
    let parentId = rootId;
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = cache.get(currentPath);
      if (existing) {
        parentId = existing;
        continue;
      }
      work = createNode(work, part, "directory", { parentId });
      const newNodeId = Object.keys(work.nodes).find(
        (id) => work.nodes[id].path === `Racine/${currentPath}`
      );
      if (newNodeId) {
        cache.set(currentPath, newNodeId);
        parentId = newNodeId;
      }
    }
  }

  for (const entry of entries) {
    const isDir = entry.type === "directory";
    const parts = entry.path.split("/");
    const dirParts = isDir ? parts : parts.slice(0, -1);
    const fileName = isDir ? null : parts[parts.length - 1];
    const dirPath = dirParts.join("/");
    ensureDirectory(dirPath);
    if (isDir) {
      ensureDirectory(entry.path);
    } else if (fileName) {
      const parentId = cache.get(dirPath) || rootId;
      work = createNode(work, fileName, "file", { parentId });
      const createdId = Object.keys(work.nodes).find(
        (id) => work.nodes[id].path === `Racine/${entry.path}`
      );
      if (createdId) cache.set(entry.path, createdId);
    }
  }
  // Adapter nom / meta
  return {
    ...work,
    id: `preset-${key}`,
    name: `Preset ${key}`,
    description: `Arborescence ${key}`,
  };
}

/**
 * Ancienne logique de fusion conservée si besoin d'ajouter un preset sans reset.
 */
export function addPresetToTemplate(
  template: HierarchyTemplate | null,
  key: PresetKey
): HierarchyTemplate {
  const entries = PRESETS[key];
  if (!entries) return template || createDefaultTemplate();
  let work = template || createDefaultTemplate();
  const rootId = work.rootNodes[0];

  // Index rapide par chemin relatif (sans la racine) -> id
  const cache = new Map<string, string>();
  cache.set("", rootId); // racine

  // Pré-charger les chemins existants pour éviter doublons
  Object.values(work.nodes).forEach((n) => {
    if (n.id === rootId) return;
    // retirer le préfixe "Racine/" de n.path
    const rel = n.path.startsWith("Racine/") ? n.path.slice(7) : n.path;
    cache.set(rel, n.id);
  });

  function ensureDirectory(dirPath: string) {
    if (dirPath === "") return;
    if (cache.has(dirPath)) return; // déjà présent
    const parts = dirPath.split("/");
    // s'assurer que chaque segment existe
    let currentPath = "";
    let parentId = rootId;
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = cache.get(currentPath);
      if (existing) {
        parentId = existing;
        continue;
      }
      // créer le dossier manquant
      work = createNode(work, part, "directory", { parentId });
      const newNodeId = Object.keys(work.nodes).find(
        (id) => work!.nodes[id].path === `Racine/${currentPath}`
      );
      if (newNodeId) {
        cache.set(currentPath, newNodeId);
        parentId = newNodeId;
      }
    }
  }

  for (const entry of entries) {
    const isDir = entry.type === "directory";
    const parts = entry.path.split("/");
    const dirParts = isDir ? parts : parts.slice(0, -1);
    const fileName = isDir ? null : parts[parts.length - 1];
    const dirPath = dirParts.join("/");
    ensureDirectory(dirPath);
    if (isDir) {
      ensureDirectory(entry.path);
    } else if (fileName) {
      const fullPath = entry.path;
      if (cache.has(fullPath)) continue; // fichier présent
      const parentId = cache.get(dirPath) || rootId;
      work = createNode(work, fileName, "file", { parentId });
      // retrouver l'id via path pour cacher
      const createdId = Object.keys(work.nodes).find(
        (id) => work.nodes[id].path === `Racine/${fullPath}`
      );
      if (createdId) cache.set(fullPath, createdId);
    }
  }

  return work;
}
