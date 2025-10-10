import React, { useState, useMemo } from "react";
import { zipFolderPickerStyles as s } from "./ZipFolderPicker.styles";
import { zipFolderPickerExtraStyles as xs } from "./ZipFolderPicker.extra.styles";
import { useZipTree } from "../../hooks/useZipTree";
import type { ZipTreeNode } from "../../hooks/useZipTree";
import type { ZipSource } from "../../types/zip";
import { ZipBreadcrumb } from "./ZipBreadcrumb/ZipBreadcrumb";
import { ZipTreeView } from "./ZipTreeView/ZipTreeView";

interface ZipFolderPickerProps {
  zipSource: ZipSource;
  /** Callback appelée quand l'utilisateur sélectionne un dossier. */
  onSelect: (folderPath: string) => void;
  title?: string;
  inline?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

/** Sélecteur d'un dossier racine dans une archive ZIP analysée. */
export const ZipFolderPicker: React.FC<ZipFolderPickerProps> = ({
  zipSource,
  onSelect,
  title = "Sélection du dossier racine",
  inline = false,
  isOpen = true,
  onClose,
}) => {
  const { tree, status, error } = useZipTree(zipSource);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));
  const [activePath, setActivePath] = useState<string>("");
  const [hasFocus, setHasFocus] = useState(false);
  const nodeIndex = useMemo(() => {
    const map = new Map<string, ZipTreeNode>();
    const walk = (n: ZipTreeNode) => {
      map.set(n.path, n);
      n.children.forEach(walk);
    };
    if (tree) walk(tree);
    return map;
  }, [tree]);

  const breadcrumbPath = activePath;

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const visibleNodes = useMemo(() => {
    if (!tree) return [] as ZipTreeNode[];
    const list: ZipTreeNode[] = [];
    const walk = (n: ZipTreeNode) => {
      list.push(n);
      if (n.type === "dir" && expanded.has(n.path)) {
        n.children.forEach(walk);
      }
    };
    walk(tree);
    return list;
  }, [tree, expanded]);

  if (!inline && !isOpen) return null;

  const content = (
    <div style={xs.container}>
      <div style={s.breadcrumb}>
        <ZipBreadcrumb
          currentPath={breadcrumbPath}
          onNavigate={(p) => {
            setActivePath(p);
            onSelect(p);
          }}
        />
      </div>
      <div
        style={{ ...s.inlineScrollArea, ...xs.focusableScroll(hasFocus) }}
        tabIndex={0}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        onKeyDown={(e) => {
          if (!tree) return;
          const currentNode = nodeIndex.get(activePath) || tree;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            if (currentNode.type === "dir" && expanded.has(currentNode.path)) {
              toggle(currentNode.path);
            } else {
              if (currentNode.path.includes("/")) {
                const parentPath = currentNode.path.slice(
                  0,
                  currentNode.path.lastIndexOf("/")
                );
                setActivePath(parentPath);
                onSelect(parentPath);
              } else if (currentNode.path !== "") {
                setActivePath("");
                onSelect("");
              }
            }
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            if (currentNode.type === "dir") {
              if (!expanded.has(currentNode.path)) {
                toggle(currentNode.path);
              } else if (currentNode.children.length) {
                const firstChild = currentNode.children[0];
                setActivePath(firstChild.path);
                if (firstChild.type === "dir") onSelect(firstChild.path);
              }
            }
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const idx = visibleNodes.findIndex(
              (n) => n.path === currentNode.path
            );
            const nextNode = visibleNodes[idx + 1];
            if (nextNode) {
              setActivePath(nextNode.path);
              if (nextNode.type === "dir") onSelect(nextNode.path);
            }
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const idx = visibleNodes.findIndex(
              (n) => n.path === currentNode.path
            );
            const prevNode = visibleNodes[idx - 1];
            if (prevNode) {
              setActivePath(prevNode.path);
              if (prevNode.type === "dir") onSelect(prevNode.path);
            }
          } else if (e.key === "Home") {
            e.preventDefault();
            const first = visibleNodes[0];
            if (first) {
              setActivePath(first.path);
              if (first.type === "dir") onSelect(first.path);
            }
          } else if (e.key === "End") {
            e.preventDefault();
            const last = visibleNodes[visibleNodes.length - 1];
            if (last) {
              setActivePath(last.path);
              if (last.type === "dir") onSelect(last.path);
            }
          }
        }}
      >
        {status === "loading" && <p style={xs.loading}>Analyse…</p>}
        {status === "error" && <p style={xs.error}>{error}</p>}
        {status === "ready" && tree && (
          <ZipTreeView
            root={tree}
            currentPath={activePath}
            onNavigate={(p) => {
              setActivePath(p);
              onSelect(p);
            }}
          />
        )}
      </div>
    </div>
  );

  if (inline) return <>{content}</>;

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
