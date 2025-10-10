import { useEffect, useState } from "react";
import type { IZipEntryMeta, ZipSource } from "../types/zip";
import { collectEntriesFromJSZip } from "../services/zipEntryUtils";

export interface ZipTreeNode {
  /** Nom de l'entrée (fichier ou dossier). */
  name: string;
  /** Chemin relatif depuis la racine ZIP ('' = racine). */
  path: string;
  /** Enfants si dossier, vide sinon. */
  children: ZipTreeNode[];
  /** Type d'entrée. */
  type: "dir" | "file";
}

function buildTreeFromEntries(entries: IZipEntryMeta[]): ZipTreeNode {
  const root: ZipTreeNode = { name: "/", path: "", children: [], type: "dir" };
  const dirMap = new Map<string, ZipTreeNode>();
  dirMap.set("", root);

  const dirs = entries.filter((e) => e.isDir);
  const files = entries.filter((e) => !e.isDir);

  for (const dir of dirs) {
    const parts = dir.path.split("/").filter(Boolean);
    if (!parts.length) continue;
    let currentPath = "";
    let parent = root;
    for (const segment of parts) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let node = dirMap.get(currentPath);
      if (!node) {
        node = { name: segment, path: currentPath, children: [], type: "dir" };
        dirMap.set(currentPath, node);
        parent.children.push(node);
      }
      parent = node;
    }
  }

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    if (!parts.length) continue;
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parentNode = dirMap.get(parentPath) ?? root;
    parentNode.children.push({
      name,
      path: file.path,
      children: [],
      type: "file",
    });
  }

  const sortRec = (node: ZipTreeNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortRec);
  };

  sortRec(root);
  return root;
}

/**
 * Charge un fichier ZIP (File) de manière asynchrone et expose un arbre trié
 * prêt à afficher. Gère les états: idle | loading | error | ready.
 */
export function useZipTree(zipSource: ZipSource | null) {
  const [tree, setTree] = useState<ZipTreeNode | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">(
    "idle"
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!zipSource) {
      setTree(null);
      setStatus("idle");
      setError(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const JSZip = (await import("jszip")).default;
        const data = await zipSource.file.arrayBuffer();
        const zip = await JSZip.loadAsync(data);
        const entries = await collectEntriesFromJSZip(zip);
        if (cancelled) return;
        setTree(buildTreeFromEntries(entries));
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError("Impossible de lire le ZIP");
          console.error(e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zipSource]);

  return { tree, status, error } as const;
}
