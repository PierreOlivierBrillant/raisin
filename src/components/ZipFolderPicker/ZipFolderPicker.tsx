import React, { useEffect, useState, useMemo } from "react";
import JSZip from "jszip";
import { zipFolderPickerStyles as s } from "./ZipFolderPicker.styles";

export interface ZipTreeNode {
  name: string;
  path: string; // chemin relatif racine ('' pour racine)
  children: ZipTreeNode[];
  type: "dir" | "file";
}

interface ZipFolderPickerProps {
  zipFile: File;
  onSelect: (folderPath: string) => void; // '' représente racine
  title?: string;
  // Mode inline : pas de dialogue, directement intégré dans l'UI
  inline?: boolean;
  // Mode overlay (legacy) : conservé si besoin futur, fallback sur inline si non précisé
  isOpen?: boolean;
  onClose?: () => void;
}

interface BuildingState {
  status: "idle" | "loading" | "error" | "ready";
  error?: string;
}

// Construit un arbre de répertoires à partir d'un objet JSZip
function buildZipTree(zip: JSZip): ZipTreeNode {
  const root: ZipTreeNode = { name: "/", path: "", children: [], type: "dir" };
  const dirMap: Record<string, ZipTreeNode> = { "": root };

  zip.forEach((relativePath, entry) => {
    const parts = relativePath.split("/").filter(Boolean);
    let currentPath = "";
    let parent = root;
    parts.forEach((segment, idx) => {
      const isLast = idx === parts.length - 1;
      if (isLast && !entry.dir) {
        // fichier
        parent.children.push({
          name: segment,
          path: currentPath ? currentPath + "/" + segment : segment,
          // path complet (sans slash initial)
          children: [],
          type: "file",
        });
      } else {
        // dossier
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

  // Tri dossiers/fichiers
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

export const ZipFolderPicker: React.FC<ZipFolderPickerProps> = ({
  zipFile,
  onSelect,
  title = "Sélection du dossier racine",
  inline = false,
  isOpen = true,
  onClose,
}) => {
  const [tree, setTree] = useState<ZipTreeNode | null>(null);
  const [state, setState] = useState<BuildingState>({ status: "idle" });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));
  const [activePath, setActivePath] = useState<string>("");

  useEffect(() => {
    if (!inline && !isOpen) return;
    let cancelled = false;
    (async () => {
      setState({ status: "loading" });
      try {
        const data = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(data);
        if (cancelled) return;
        const t = buildZipTree(zip);
        setTree(t);
        setState({ status: "ready" });
      } catch (e) {
        console.error(e);
        if (!cancelled)
          setState({ status: "error", error: "Impossible de lire le ZIP" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zipFile, isOpen, inline]);

  const breadcrumb = useMemo(() => {
    if (!activePath) return ["/"];
    const parts = activePath.split("/");
    return ["/", ...parts];
  }, [activePath]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: ZipTreeNode, depth = 0): React.ReactNode => {
    const isDir = node.type === "dir";
    const isExpanded = expanded.has(node.path);
    const isActive = activePath === node.path;
    return (
      <div key={node.path || "/"}>
        <div
          style={{
            ...s.nodeRow,
            ...(isActive ? s.nodeRowActive : {}),
            paddingLeft: depth * 14 + 6,
          }}
          onClick={() => {
            if (isDir) {
              setActivePath(node.path);
              onSelect(node.path); // sélection immédiate dossier
              toggle(node.path);
            }
          }}
        >
          <span style={s.disclosure}>
            {isDir ? (isExpanded ? "▾" : "▸") : ""}
          </span>
          <span>{node.name || "/"}</span>
        </div>
        {isDir &&
          isExpanded &&
          node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  if (!inline && !isOpen) return null;

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: ".5rem",
        flex: 1,
      }}
    >
      <ul style={s.breadcrumb}>
        {breadcrumb.map((segment, i) => {
          const path = breadcrumb.slice(1, i + 1).join("/");
          return (
            <li key={i} style={s.breadcrumbItem}>
              {i > 0 && <span style={{ opacity: 0.6 }}>/</span>}
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  cursor: "pointer",
                  fontSize: ".65rem",
                  color: "#2563eb",
                }}
                onClick={() => setActivePath(path)}
              >
                {segment === "/" ? "Racine" : segment}
              </button>
            </li>
          );
        })}
      </ul>
      <div style={s.inlineScrollArea}>
        {state.status === "loading" && (
          <p style={{ fontSize: ".7rem" }}>Analyse…</p>
        )}
        {state.status === "error" && (
          <p style={{ fontSize: ".7rem", color: "#b91c1c" }}>{state.error}</p>
        )}
        {state.status === "ready" && tree && renderNode(tree)}
      </div>
    </div>
  );

  if (inline) {
    // Mode inline minimal : uniquement l'arborescence + dossier actif
    return <>{content}</>;
  }

  return (
    <div style={s.overlay} role="dialog" aria-modal="true">
      <div style={s.dialog}>
        <div style={s.header}>
          <h3 style={s.title}>{title}</h3>
          <button className="btn btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div style={s.body}>{content}</div>
      </div>
    </div>
  );
};
