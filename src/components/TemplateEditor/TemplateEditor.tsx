import React, { useState, useEffect, useRef } from "react";
import yaml from "js-yaml";
import { GraphCanvas } from "./GraphCanvas/GraphCanvas";
import { TemplateToolbar } from "./TemplateToolbar/TemplateToolbar";
import { NodePanel } from "./NodePanel/NodePanel";
import type { HierarchyTemplate, YamlHierarchy } from "../../types";
import { teStyles } from "./TemplateEditor.styles";
import {
  createDefaultTemplate,
  ensureRootInvariant,
  createNode,
  updateNodeAttributes,
  deleteNodeAndDescendants,
  toYamlHierarchy,
  fromYamlHierarchy,
} from "./TemplateEditor.logic";
import { buildPresetTemplate } from "./TemplatePresets";
import type { PresetKey } from "./TemplatePresets";

interface TemplateEditorProps {
  template: HierarchyTemplate | null;
  onTemplateChange: (template: HierarchyTemplate) => void;
  forcedHeight?: number; // hauteur imposée par le parent (viewport calculé)
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onTemplateChange,
  forcedHeight,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState<"file" | "directory">("directory");
  const [childName, setChildName] = useState("");
  const [childType, setChildType] = useState<"file" | "directory">("directory");
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const outerRef = useRef<HTMLDivElement | null>(null);
  const graphAreaRef = useRef<HTMLDivElement | null>(null);
  const [graphHeight, setGraphHeight] = useState<number>(400);

  useEffect(() => {
    if (!template) onTemplateChange(createDefaultTemplate());
  }, [template, onTemplateChange]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Plus de calcul JS de hauteur : on laisse flex gérer.
  // Re-calcul dédié pour la hauteur réelle du graph (plein écran disponible)
  useEffect(() => {
    const recompute = () => {
      if (!graphAreaRef.current) return;
      const rect = graphAreaRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const bottomPadding = 24; // petit buffer
      const h = vh - rect.top - bottomPadding;
      setGraphHeight(h > 400 ? h : 400);
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [forcedHeight]);

  useEffect(() => {
    if (!template || !selectedNode) return;
    const updated = updateNodeAttributes(template, selectedNode, {
      name: nodeName,
      type: nodeType,
    });
    if (updated) onTemplateChange(updated);
  }, [nodeName, nodeType, selectedNode, template, onTemplateChange]);

  const addChildNode = () => {
    if (!template || !selectedNode || !childName) return;
    const updated = createNode(template, childName, childType, {
      parentId: selectedNode,
    });
    onTemplateChange(updated);
    setChildName("");
    setChildType("directory");
  };

  const deleteSelectedNode = () => {
    if (!template || !selectedNode) return;
    const node = template.nodes[selectedNode];
    if (!node) return;
    if (!confirm(`Supprimer le nœud "${node.name}" et tous ses descendants ?`))
      return;
    const updated = deleteNodeAndDescendants(template, selectedNode);
    if (!updated) return;
    onTemplateChange(updated);
    setSelectedNode(null);
    setNodeName("");
    setChildName("");
  };

  const exportTemplate = () => {
    if (!template) return;
    try {
      const yStruct = toYamlHierarchy(template);
      const yamlStr = yaml.dump(yStruct, { noRefs: true, indent: 2 });
      const blob = new Blob([yamlStr], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name || "modele"}.yml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors de la génération YAML");
    }
  };

  const importTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = yaml.load(text);
        if (!parsed || typeof parsed !== "object")
          throw new Error("Format invalide");
        const maybe = parsed as YamlHierarchy;
        if (!maybe.root || !maybe.root.name || !maybe.root.type) {
          throw new Error("Structure hiérarchique manquante (root)");
        }
        const rebuilt = fromYamlHierarchy(maybe);
        onTemplateChange(ensureRootInvariant(rebuilt));
      } catch {
        alert(
          "Erreur lors de l'importation du modèle (YAML hiérarchique attendu)"
        );
      }
    };
    reader.readAsText(file);
  };

  const showPanel = !!selectedNode;
  useEffect(() => {
    setLayoutVersion((v) => v + 1);
  }, [showPanel]);
  const panelWidth = 340; // largeur cible px

  return (
    <div
      ref={outerRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        flex: 1,
        minHeight: 0,
        height: forcedHeight ? forcedHeight : "100%",
      }}
    >
      <div style={{ marginBottom: "0.5rem" }}>
        <TemplateToolbar
          onExport={exportTemplate}
          onImport={importTemplate}
          onAddPreset={(key: PresetKey) => {
            const updated = buildPresetTemplate(key);
            onTemplateChange(updated);
            setSelectedNode(null);
            setNodeName("");
          }}
        />
      </div>
      {!isMobile && (
        <div
          style={{
            display: "flex",
            flex: 1,
            minHeight: 0,
            width: "100%",
            alignItems: "stretch",
            gap: "0.5rem",
            height: "100%",
          }}
        >
          <div
            style={{
              ...teStyles.graphWrapper,
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              height: graphHeight,
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
            ref={graphAreaRef}
          >
            {template && (
              <GraphCanvas
                template={template}
                selectedNode={selectedNode}
                onSelectNode={(id, meta) => {
                  setSelectedNode(id);
                  if (id && meta) {
                    setNodeName(meta.name);
                    setNodeType(meta.type);
                  } else if (!id) {
                    setNodeName("");
                  }
                }}
                layoutVersion={layoutVersion}
              />
            )}
            <div
              style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(4px)",
                  border: "1px solid #e5e7eb",
                  borderRadius: ".5rem",
                  padding: ".4rem .55rem",
                  display: "flex",
                  gap: ".9rem",
                  alignItems: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: "#EF4444",
                      boxShadow: "0 0 0 2px #7F1D1D inset",
                    }}
                  />
                  <span style={{ fontSize: ".65rem", color: "#374151" }}>
                    Racine
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: "#3B82F6",
                      boxShadow: "0 0 0 2px #1D4ED8 inset",
                    }}
                  />
                  <span style={{ fontSize: ".65rem", color: "#374151" }}>
                    Dossiers
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: "#10B981",
                      boxShadow: "0 0 0 2px #047857 inset",
                    }}
                  />
                  <span style={{ fontSize: ".65rem", color: "#374151" }}>
                    Fichiers
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              width: showPanel ? panelWidth : 0,
              transition: "width 240ms ease",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              borderLeft: showPanel
                ? "1px solid #e5e7eb"
                : "1px solid transparent",
              boxSizing: "border-box",
              paddingLeft: showPanel ? "0.5rem" : 0,
            }}
            aria-hidden={!showPanel}
          >
            <AnimatedNodePanel show={showPanel} duration={240}>
              <NodePanel
                selectedNode={selectedNode}
                rootId={template?.rootNodes[0] ?? null}
                selectedNodeHasChildren={
                  !!selectedNode &&
                  !!template?.nodes[selectedNode] &&
                  template!.nodes[selectedNode].children.length > 0
                }
                nodeName={nodeName}
                setNodeName={setNodeName}
                nodeType={nodeType}
                setNodeType={setNodeType}
                childName={childName}
                setChildName={setChildName}
                childType={childType}
                setChildType={setChildType}
                addChildNode={addChildNode}
                deleteSelectedNode={deleteSelectedNode}
              />
            </AnimatedNodePanel>
          </div>
        </div>
      )}
      {isMobile && (
        <div style={{ marginTop: "0.75rem" }}>
          <AnimatedNodePanel show={showPanel} duration={240}>
            <NodePanel
              selectedNode={selectedNode}
              rootId={template?.rootNodes[0] ?? null}
              selectedNodeHasChildren={
                !!selectedNode &&
                !!template?.nodes[selectedNode] &&
                template!.nodes[selectedNode].children.length > 0
              }
              nodeName={nodeName}
              setNodeName={setNodeName}
              nodeType={nodeType}
              setNodeType={setNodeType}
              childName={childName}
              setChildName={setChildName}
              childType={childType}
              setChildType={setChildType}
              addChildNode={addChildNode}
              deleteSelectedNode={deleteSelectedNode}
            />
          </AnimatedNodePanel>
        </div>
      )}
    </div>
  );
};

interface AnimatedNodePanelProps {
  show: boolean;
  duration?: number;
  children: React.ReactNode;
}

const AnimatedNodePanel: React.FC<AnimatedNodePanelProps> = ({
  show,
  duration = 250,
  children,
}) => {
  const [render, setRender] = React.useState(show);
  const [visible, setVisible] = React.useState(show);

  React.useEffect(() => {
    if (show) {
      setRender(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setRender(false), duration);
      return () => clearTimeout(t);
    }
  }, [show, duration]);

  if (!render) return null;
  return (
    <div
      style={{
        transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(12px)",
        pointerEvents: visible ? "auto" : "none",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
};
