import React, { useMemo } from "react";
import type { ZipTreeNode } from "../../../hooks/useZipTree";

interface ZipTreeViewProps {
  root: ZipTreeNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onSelectFile?: (path: string) => void;
}

/** Liste plate d'un dossier courant (sous‑arbres navigables). */
export const ZipTreeView: React.FC<ZipTreeViewProps> = ({
  root,
  currentPath,
  onNavigate,
  onSelectFile,
}) => {
  const currentNode = useMemo(() => {
    if (!currentPath) return root;
    const parts = currentPath.split("/").filter(Boolean);
    let node: ZipTreeNode | undefined = root;
    for (const p of parts) {
      node = node.children.find((c) => c.name === p && c.type === "dir");
      if (!node) break;
    }
    return node || root;
  }, [root, currentPath]);

  const dirs = currentNode.children.filter((c) => c.type === "dir");
  const files = currentNode.children.filter((c) => c.type === "file");

  return (
    <div className="zip-tree">
      {dirs.length === 0 && files.length === 0 && (
        <div className="empty">Dossier vide</div>
      )}
      {dirs.map((d) => (
        <div
          key={d.path}
          className="row dir"
          onClick={() => onNavigate(d.path)}
        >
          📁 {d.name}
        </div>
      ))}
      {files.map((f) => (
        <div
          key={f.path}
          className="row file"
          onClick={() => onSelectFile?.(f.path)}
        >
          📄 {f.name}
        </div>
      ))}
    </div>
  );
};
