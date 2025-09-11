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
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onTemplateChange,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState<"file" | "directory">("directory");
  // Champs pour ajout direct d'un enfant au nœud sélectionné
  const [childName, setChildName] = useState("");
  const [childType, setChildType] = useState<"file" | "directory">("directory");
  // Notion 'Requis' supprimée
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const graphCardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!template) onTemplateChange(createDefaultTemplate());
  }, [template, onTemplateChange]);

  // d3 graph moved out in refactor; placeholder ref kept if needed later

  // resize handled internally in GraphCanvas

  // Gestion responsive de la grille (empilement sur mobile)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Plus de calcul complexe de hauteur : le SVG prendra 100% de la place restante via flex
  useEffect(() => {
    if (isMobile) {
      setCardHeight(undefined);
      return;
    }
    const compute = () => {
      if (!graphCardRef.current) return;
      const top = graphCardRef.current.getBoundingClientRect().top;
      const vh = window.innerHeight;
      // On enlève 1px pour éviter un dépassement qui crée une mini scrollbar
      const extraBottom = 33; // inclut marge potentielle + arrondi
      const h = vh - top - extraBottom;
      setCardHeight(h > 400 ? h : 400);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [isMobile]);

  // Racine immuable : pas de création de racine

  // Mise à jour en direct du nœud sélectionné (nom / type)
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
  // Incrémente une version à chaque transition d'ouverture/fermeture pour déclencher recentrage
  useEffect(() => {
    setLayoutVersion((v) => v + 1);
  }, [showPanel]);
  const panelWidth = 340; // largeur cible px

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: isMobile ? "column" : "column",
        width: "100%",
        boxSizing: "border-box",
        alignItems: "stretch",
        minHeight: isMobile ? undefined : cardHeight,
        // Réserve l'espace horizontal uniquement quand le panneau est visible
        paddingRight: !isMobile && showPanel ? panelWidth : 0,
        transition: "padding-right 240ms ease",
      }}
    >
      <div
        ref={graphCardRef}
        className="card card-no-mb-desktop"
        style={{
          display: "flex",
          flexDirection: "column",
          height: cardHeight,
          minWidth: 0,
          // Sur desktop laisser la largeur pleine (le panel sera overlay)
        }}
      >
        <TemplateToolbar
          onExport={exportTemplate}
          onImport={importTemplate}
          onAddPreset={(key: PresetKey) => {
            const updated = buildPresetTemplate(key); // reset complet
            onTemplateChange(updated);
            setSelectedNode(null);
            setNodeName("");
          }}
        />
        <div
          style={{
            ...teStyles.graphWrapper,
            flex: 1,
            minHeight: isMobile ? 400 : 400,
          }}
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
              panelOpen={showPanel}
              panelWidth={panelWidth}
            />
          )}
        </div>
        <div style={teStyles.legend} className="no-last-mb graph-legend">
          <p
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: "#EF4444",
                  boxShadow: "0 0 0 2px #7F1D1D inset",
                }}
              />
              Racine
            </span>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: "#3B82F6",
                  boxShadow: "0 0 0 2px #1D4ED8 inset",
                }}
              />
              Dossiers
            </span>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: "#10B981",
                  boxShadow: "0 0 0 2px #047857 inset",
                }}
              />
              Fichiers
            </span>
          </p>
        </div>
      </div>
      {isMobile ? (
        <div style={{ marginTop: "1rem" }}>
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
      ) : (
        <div
          className="node-panel-transition"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: panelWidth,
            transform: showPanel ? "translateX(0)" : "translateX(100%)",
            transition: "transform 240ms ease",
            boxSizing: "border-box",
            paddingLeft: "0.5rem",
            pointerEvents: showPanel ? "auto" : "none",
            display: "flex",
            flexDirection: "column",
          }}
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
      )}
    </div>
  );
};

// Petit composant interne pour gérer animation entrée/sortie sans complexité externe
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
      // laisser le temps au montage avant de déclencher transition
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
