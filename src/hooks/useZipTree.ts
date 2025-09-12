import { useEffect, useState } from "react";
import JSZip from "jszip";

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

/**
 * Construit un arbre typé (dossiers/fichiers) à partir d'une instance JSZip.
 * Tous les segments intermédiaires sont matérialisés comme nœuds de type 'dir'.
 */
export function buildZipTree(zip: JSZip): ZipTreeNode {
  const root: ZipTreeNode = { name: "/", path: "", children: [], type: "dir" };
  const dirMap: Record<string, ZipTreeNode> = { "": root };
  zip.forEach((relativePath, entry) => {
    const parts = relativePath.split("/").filter(Boolean);
    let currentPath = "";
    let parent = root;
    parts.forEach((segment, idx) => {
      const isLast = idx === parts.length - 1;
      if (isLast && !entry.dir) {
        parent.children.push({
          name: segment,
          path: currentPath ? currentPath + "/" + segment : segment,
          children: [],
          type: "file",
        });
      } else {
        currentPath = currentPath ? currentPath + "/" + segment : segment;
        if (!dirMap[currentPath]) {
          const dirNode: ZipTreeNode = {
            name: segment,
            path: currentPath,
            children: [],
            type: "dir",
          };
          dirMap[currentPath] = dirNode;
          parent.children.push(dirNode);
        }
        parent = dirMap[currentPath];
      }
    });
  });
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
export function useZipTree(zipFile: File | null) {
  const [tree, setTree] = useState<ZipTreeNode | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">(
    "idle"
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!zipFile) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const data = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(data);
        if (cancelled) return;
        setTree(buildZipTree(zip));
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
  }, [zipFile]);

  return { tree, status, error } as const;
}
