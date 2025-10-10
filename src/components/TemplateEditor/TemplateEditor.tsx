import React, { useState, useEffect, useMemo, useRef } from "react";
import yaml from "js-yaml";
import { GraphCanvas } from "./GraphCanvas/GraphCanvas";
import { TemplateToolbar } from "./TemplateToolbar/TemplateToolbar";
import { NodePanel } from "./NodePanel/NodePanel";
import { LegendPalette } from "./LegendPalette/LegendPalette";
import type { HierarchyTemplate, YamlHierarchy } from "../../types";
import { teStyles } from "./TemplateEditor.styles";
import { useGraphHeight } from "../../hooks/useGraphHeight";
import {
  createDefaultTemplate,
  ensureRootInvariant,
  createNode,
  updateNodeAttributes,
  deleteNodeAndDescendants,
  addRootNode,
  extractTemplateForRoot,
  appendTemplateRoot,
  toYamlHierarchy,
  fromYamlHierarchy,
  removeRootNode,
} from "./TemplateEditor.logic";
import { buildPresetTemplate } from "./TemplatePresets";
import type { PresetKey } from "./TemplatePresets";
import Modal from "../Modal/Modal";

interface TemplateEditorProps {
  template: HierarchyTemplate | null;
  onTemplateChange: (template: HierarchyTemplate) => void;
  /** Hauteur imposée par le parent (ex: calcul plein écran). */
  forcedHeight?: number;
}

/** Éditeur interactif de modèle hiérarchique (graph + panneau latéral). */
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
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [presetToAdd, setPresetToAdd] = useState<PresetKey | null>(null);
  const [showPresetConfirm, setShowPresetConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const graphAreaRef = useRef<HTMLDivElement | null>(null);
  const graphHeight = useGraphHeight([forcedHeight, template]);
  const safeGraphHeight = useMemo(() => {
    if (!forcedHeight) return graphHeight;
    const reserve = isMobile ? 160 : 220;
    const maxAvailable = Math.max(280, forcedHeight - reserve);
    return Math.max(280, Math.min(graphHeight, maxAvailable));
  }, [graphHeight, forcedHeight, isMobile]);
  const activeTemplate = useMemo(() => {
    if (!template || !activeRootId) return null;
    return extractTemplateForRoot(template, activeRootId);
  }, [template, activeRootId]);
  const activeNodeIds = useMemo(() => {
    if (!activeTemplate) return new Set<string>();
    return new Set(Object.keys(activeTemplate.nodes));
  }, [activeTemplate]);

  useEffect(() => {
    if (!template) {
      const fallback = createDefaultTemplate();
      onTemplateChange(fallback);
      const newRootId = fallback.rootNodes[0] ?? null;
      setActiveRootId(newRootId);
      setSelectedNode(newRootId);
      if (newRootId) {
        const node = fallback.nodes[newRootId];
        setNodeName(node?.name ?? "");
        setNodeType(node?.type ?? "directory");
        setNameError(null);
      }
    }
  }, [template, onTemplateChange]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setNameError(null);
  }, [selectedNode]);

  useEffect(() => {
    if (!template || template.rootNodes.length === 0) {
      setActiveRootId(null);
      setNameError(null);
      return;
    }
    if (!activeRootId || !template.rootNodes.includes(activeRootId)) {
      setActiveRootId(template.rootNodes[0]);
    }
  }, [template, activeRootId]);

  useEffect(() => {
    if (!template || !selectedNode) return;
    const updated = updateNodeAttributes(template, selectedNode, {
      name: nodeName,
      type: nodeType,
    });
    if (updated) {
      setNameError(null);
      onTemplateChange(updated);
      return;
    }
    const currentNode = template.nodes[selectedNode];
    if (!currentNode) {
      setNameError(null);
      return;
    }
    const isRoot = template.rootNodes.includes(selectedNode);
    if (isRoot) {
      const trimmed = nodeName.trim();
      const duplicate =
        trimmed.length > 0 &&
        template.rootNodes
          .filter((id) => id !== selectedNode)
          .some(
            (id) =>
              template.nodes[id]?.name.toLowerCase() === trimmed.toLowerCase()
          );
      setNameError(duplicate ? "Nom déjà utilisé par une autre racine." : null);
    } else {
      setNameError(null);
    }
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
    setNameError(null);
  };

  const deleteActiveRoot = () => {
    if (!template || !selectedNode) return;
    if (!template.rootNodes.includes(selectedNode)) return;
    if (template.rootNodes.length <= 1) return;
    const node = template.nodes[selectedNode];
    const label = node?.name ?? "cette racine";
    if (
      !confirm(`Supprimer la racine "${label}" et toute son arborescence ?`)
    ) {
      return;
    }
    const updated = removeRootNode(template, selectedNode);
    if (!updated) return;
    onTemplateChange(updated);
    const fallbackRoot = updated.rootNodes[0] ?? null;
    setActiveRootId(fallbackRoot);
    setSelectedNode(fallbackRoot);
    if (fallbackRoot) {
      const fallbackNode = updated.nodes[fallbackRoot];
      setNodeName(fallbackNode?.name ?? "");
      setNodeType("directory");
    } else {
      setNodeName("");
      setNodeType("directory");
    }
    setChildName("");
    setNameError(null);
  };

  const handleAddRoot = () => {
    if (!template) return;
    const baseName = `Nouvelle racine ${template.rootNodes.length + 1}`;
    const { template: nextTemplate, rootId } = addRootNode(template, baseName);
    onTemplateChange(nextTemplate);
    setActiveRootId(rootId);
    setSelectedNode(rootId);
    const node = nextTemplate.nodes[rootId];
    setNodeName(node?.name ?? baseName);
    setNodeType("directory");
    setChildName("");
    setNameError(null);
  };

  const applyPresetTemplate = (key: PresetKey, replaceExisting = false) => {
    const presetTemplate = ensureRootInvariant(buildPresetTemplate(key));
    if (!template || template.rootNodes.length === 0 || replaceExisting) {
      onTemplateChange(presetTemplate);
      const rootId = presetTemplate.rootNodes[0] ?? null;
      setActiveRootId(rootId);
      setSelectedNode(rootId);
      if (rootId) {
        const node = presetTemplate.nodes[rootId];
        setNodeName(node?.name ?? "");
        setNodeType(node?.type ?? "directory");
      }
      setChildName("");
      setNameError(null);
      return;
    }
    const { template: merged, rootId } = appendTemplateRoot(
      template,
      presetTemplate
    );
    onTemplateChange(merged);
    if (rootId) {
      setActiveRootId(rootId);
      setSelectedNode(rootId);
      const node = merged.nodes[rootId];
      setNodeName(node?.name ?? "");
      setNodeType("directory");
    }
    setChildName("");
    setNameError(null);
  };

  const handleAddPreset = (key: PresetKey) => {
    if (!template || template.rootNodes.length === 0) {
      applyPresetTemplate(key, true);
      return;
    }
    const hasPopulatedRoot = template.rootNodes.some((id) => {
      const node = template.nodes[id];
      return node && node.children.length > 0;
    });
    if (!hasPopulatedRoot) {
      applyPresetTemplate(key, true);
      return;
    }
    if (hasPopulatedRoot) {
      setPresetToAdd(key);
      setShowPresetConfirm(true);
      return;
    }
    applyPresetTemplate(key);
  };

  const confirmPresetAddition = () => {
    if (!presetToAdd) return;
    applyPresetTemplate(presetToAdd);
    setPresetToAdd(null);
    setShowPresetConfirm(false);
  };

  const cancelPresetAddition = () => {
    setPresetToAdd(null);
    setShowPresetConfirm(false);
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
        const hasRootsArray = Array.isArray(maybe.roots) && maybe.roots.length;
        const hasSingleRoot = !!maybe.root;
        if (!hasRootsArray && !hasSingleRoot) {
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
  useEffect(() => {
    if (selectedNode && !activeNodeIds.has(selectedNode)) {
      setSelectedNode(null);
      setNodeName("");
      setNodeType("directory");
      setChildName("");
      setNameError(null);
    }
  }, [selectedNode, activeNodeIds]);
  const panelWidth = 340;
  const graphTemplate = activeTemplate ?? template;
  const selectedNodeHasChildren = Boolean(
    selectedNode && template?.nodes[selectedNode]?.children.length
  );

  return (
    <div
      ref={outerRef}
      style={{
        ...teStyles.outer,
        height: forcedHeight ? forcedHeight : "100%",
      }}
    >
      <div style={teStyles.toolbarWrapper}>
        <TemplateToolbar
          onExport={exportTemplate}
          onImport={importTemplate}
          onAddPreset={handleAddPreset}
          onAddRoot={handleAddRoot}
        />
      </div>
      {template && template.rootNodes.length > 0 && (
        <div style={teStyles.rootTabs}>
          {template.rootNodes.map((rootId) => {
            const node = template.nodes[rootId];
            if (!node) return null;
            const isActive = rootId === activeRootId;
            return (
              <button
                key={rootId}
                className={`btn btn-compact ${
                  isActive ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => {
                  setActiveRootId(rootId);
                  setSelectedNode(rootId);
                  setNodeName(node.name);
                  setNodeType("directory");
                  setChildName("");
                  setNameError(null);
                }}
              >
                {node.name}
              </button>
            );
          })}
        </div>
      )}
      {!isMobile && (
        <div style={teStyles.mainRow}>
          <div
            style={teStyles.graphArea(safeGraphHeight)}
            ref={graphAreaRef}
            data-graph-area
          >
            {graphTemplate && (
              <GraphCanvas
                template={graphTemplate}
                selectedNode={selectedNode}
                onSelectNode={(id, meta) => {
                  setSelectedNode(id);
                  if (id && meta) {
                    const originalNode = template?.nodes[id];
                    setNodeName(originalNode?.name ?? meta.name);
                    setNodeType(originalNode?.type ?? meta.type);
                    if (template?.rootNodes.includes(id)) {
                      setActiveRootId(id);
                    }
                    setNameError(null);
                  } else if (!id) {
                    setNodeName("");
                    setNameError(null);
                  }
                }}
                layoutVersion={layoutVersion}
              />
            )}
            <div style={teStyles.legendAnchor}>
              <LegendPalette />
            </div>
          </div>
          <div
            style={teStyles.sidePanel(showPanel, panelWidth)}
            aria-hidden={!showPanel}
          >
            <AnimatedNodePanel show={showPanel} duration={240}>
              <NodePanel
                selectedNode={selectedNode}
                rootId={activeRootId ?? template?.rootNodes[0] ?? null}
                selectedNodeHasChildren={selectedNodeHasChildren}
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
                canDeleteRoot={(template?.rootNodes.length ?? 0) > 1}
                deleteRoot={deleteActiveRoot}
                nameError={nameError}
              />
            </AnimatedNodePanel>
          </div>
        </div>
      )}
      {isMobile && (
        <div style={teStyles.mobileWrapper}>
          <AnimatedNodePanel show={showPanel} duration={240}>
            <NodePanel
              selectedNode={selectedNode}
              rootId={activeRootId ?? template?.rootNodes[0] ?? null}
              selectedNodeHasChildren={selectedNodeHasChildren}
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
              canDeleteRoot={(template?.rootNodes.length ?? 0) > 1}
              deleteRoot={deleteActiveRoot}
              nameError={nameError}
            />
          </AnimatedNodePanel>
        </div>
      )}
      {showPresetConfirm && (
        <Modal
          onClose={cancelPresetAddition}
          ariaLabel="Confirmation ajout de preset"
          width="min(420px, 90%)"
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Ajouter une nouvelle racine ?</h3>
              <p
                style={{
                  margin: ".35rem 0 0",
                  fontSize: ".85rem",
                  color: "#4b5563",
                }}
              >
                Un modèle existe déjà avec {template?.rootNodes.length ?? 0}{" "}
                racine(s). Ajouter ce preset créera une nouvelle racine au lieu
                de remplacer l'existante. Souhaitez-vous continuer ?
              </p>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: ".5rem",
              }}
            >
              <button className="btn" onClick={cancelPresetAddition}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmPresetAddition}
              >
                Ajouter le preset
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

interface AnimatedNodePanelProps {
  show: boolean;
  duration?: number;
  children: React.ReactNode;
}

/**
 * Transitionne l'apparition/disparition d'un panneau latéral avec fade + slide.
 * Monte/démonte réellement le contenu lorsque l'animation est terminée.
 */
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
    <div style={teStyles.animatedPanel(visible, duration)}>{children}</div>
  );
};
