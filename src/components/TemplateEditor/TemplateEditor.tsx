import React, { useCallback, useRef, useState, useEffect } from "react";
import * as d3 from "d3";
import { Download, Upload } from "lucide-react";
import type { FileNode } from "../../types/FileNode";
import type { HierarchyTemplate } from "../../types/HierarchyTemplate";
import { teStyles } from "./TemplateEditor.styles";

interface TemplateEditorProps {
  template: HierarchyTemplate | null;
  onTemplateChange: (template: HierarchyTemplate) => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onTemplateChange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
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

  const createDefaultTemplate = useCallback((): HierarchyTemplate => {
    const nodes: Record<string, FileNode> = {
      src: {
        id: "src",
        name: "src",
        type: "directory",
        path: "src",
        children: ["components", "utils"],
      },
      components: {
        id: "components",
        name: "components",
        type: "directory",
        path: "src/components",
        parent: "src",
        children: [],
      },
      utils: {
        id: "utils",
        name: "utils",
        type: "directory",
        path: "src/utils",
        parent: "src",
        children: [],
      },
    };
    return {
      id: "default",
      name: "Modèle par défaut",
      description: "Structure de projet basique",
      nodes,
      rootNodes: ["src"],
    };
  }, []);

  useEffect(() => {
    if (!template) onTemplateChange(createDefaultTemplate());
  }, [template, onTemplateChange, createDefaultTemplate]);

  // Types D3 enrichis pour éviter les any explicites
  interface GraphNode extends FileNode {
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }
  type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
    source: string | GraphNode;
    target: string | GraphNode;
  };

  const drawGraph = useCallback(() => {
    if (!template || !svgRef.current) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    svg.selectAll("*").remove();

    // Utiliser la largeur réelle calculée du conteneur (responsive) pour centrer correctement
    const width = svgRef.current.getBoundingClientRect().width || 800;
    const container = svgRef.current.parentElement;
    const height = container ? container.clientHeight : 500; // Hauteur dynamique
    svg.attr("width", width).attr("height", height);

    // Zone cliquable de fond pour désélectionner un nœud
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .style("cursor", selectedNode ? "pointer" : "default")
      .on("click", () => {
        if (selectedNode) {
          setSelectedNode(null);
          setNodeName("");
        }
      });

    const nodeData: GraphNode[] = Object.values(template.nodes) as GraphNode[];
    const linkData: GraphLink[] = [];
    nodeData.forEach((node) =>
      node.children.forEach((childId) =>
        linkData.push({ source: node.id, target: childId } as GraphLink)
      )
    );
    // Identifier le (ou les) nœud(s) racine(s). On ne garde que le premier pour éviter la superposition.
    const primaryRootId =
      template.rootNodes && template.rootNodes.length > 0
        ? template.rootNodes[0]
        : nodeData.find((n) => !n.parent)?.id;
    const isRoot = (d: GraphNode) => d.id === primaryRootId;
    const rootNode = nodeData.find((n) => n.id === primaryRootId);
    if (rootNode) {
      rootNode.fx = width / 2;
      rootNode.fy = height / 2;
    }

    const simulation = d3
      .forceSimulation<GraphNode>(nodeData)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(linkData)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(-300))
      // Forces directionnelles plus fortes pour le nœud racine afin de l'attirer vers le centre
      .force(
        "forceXRoot",
        d3
          .forceX<GraphNode>()
          .x(width / 2)
          .strength((d) => (isRoot(d) ? 1 : 0.05))
      )
      .force(
        "forceYRoot",
        d3
          .forceY<GraphNode>()
          .y(height / 2)
          .strength((d) => (isRoot(d) ? 1 : 0.05))
      );

    const links = svg
      .append("g")
      .selectAll("line")
      .data(linkData)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2);

    const nodes = svg
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodeData)
      .enter()
      .append("g")
      .attr("class", "te-node")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on(
            "start",
            (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d) => {
              if (isRoot(d)) return; // Nœud racine fixé au centre
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            }
          )
          .on(
            "drag",
            (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d) => {
              if (isRoot(d)) return; // Ignorer drag sur racine
              d.fx = event.x;
              d.fy = event.y;
            }
          )
          .on(
            "end",
            (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d) => {
              if (isRoot(d)) return; // Laisser le root fixé
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }
          )
      );

    nodes
      .append("circle")
      .attr("r", 25)
      .attr("fill", (d) => (d.type === "directory" ? "#3B82F6" : "#10B981"))
      .attr("stroke", (d) => (selectedNode === d.id ? "#EF4444" : "#FFF"))
      .attr("stroke-width", (d) => (selectedNode === d.id ? 3 : 2))
      .on("click", (_, d) => {
        setSelectedNode(d.id);
        setNodeName(d.name);
        setNodeType(d.type);
        // plus de notion required
      });

    nodes
      .append("text")
      .text((d) => d.name)
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "white")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none");

    // indicateur requis retiré

    simulation.on("tick", () => {
      links
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);
      nodes.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
  }, [template, selectedNode]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Redessiner au resize pour maintenir le centrage du nœud racine
  useEffect(() => {
    const handle = () => drawGraph();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [drawGraph]);

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

  const addNode = () => {
    if (!template || !nodeName) return;
    const newNodeId = `node_${Date.now()}`;
    const newNode: FileNode = {
      id: newNodeId,
      name: nodeName,
      type: nodeType,
      path: nodeName,
      children: [],
    };
    const updatedNodes = { ...template.nodes, [newNodeId]: newNode };
    if (selectedNode && template.nodes[selectedNode]) {
      updatedNodes[selectedNode] = {
        ...template.nodes[selectedNode],
        children: [...template.nodes[selectedNode].children, newNodeId],
      };
      newNode.parent = selectedNode;
      newNode.path = `${template.nodes[selectedNode].path}/${nodeName}`;
    } else {
      template.rootNodes.push(newNodeId);
    }
    onTemplateChange({ ...template, nodes: updatedNodes });
    setNodeName("");
  };

  // Mise à jour en direct du nœud sélectionné (nom / type)
  useEffect(() => {
    if (!template || !selectedNode) return;
    const current = template.nodes[selectedNode];
    if (!current) return;
    // Si aucune modification, ne rien faire
    if (current.name === nodeName && current.type === nodeType) return;
    const updatedNodes = { ...template.nodes };
    updatedNodes[selectedNode] = { ...current, name: nodeName, type: nodeType };
    onTemplateChange({ ...template, nodes: updatedNodes });
    // Note: On ne recalcule pas les chemins pour ne pas casser les enfants existants.
  }, [nodeName, nodeType, selectedNode, template, onTemplateChange]);

  const addChildNode = () => {
    if (!template || !selectedNode || !childName) return;
    const parentNode = template.nodes[selectedNode];
    if (!parentNode) return;
    const newNodeId = `node_${Date.now()}`;
    const newNode: FileNode = {
      id: newNodeId,
      name: childName,
      type: childType,
      path: `${parentNode.path}/${childName}`,
      parent: parentNode.id,
      children: [],
    };
    const updatedNodes = { ...template.nodes, [newNodeId]: newNode };
    updatedNodes[parentNode.id] = {
      ...parentNode,
      children: [...parentNode.children, newNodeId],
    };
    onTemplateChange({ ...template, nodes: updatedNodes });
    setChildName("");
    setChildType("directory");
  };

  const deleteSelectedNode = () => {
    if (!template || !selectedNode) return;
    const node = template.nodes[selectedNode];
    if (!node) return;
    if (!confirm(`Supprimer le nœud "${node.name}" et tous ses descendants ?`))
      return;

    // Collecte récursive des descendants
    const toDelete = new Set<string>();
    const stack = [selectedNode];
    while (stack.length) {
      const id = stack.pop()!;
      if (toDelete.has(id)) continue;
      toDelete.add(id);
      const n = template.nodes[id];
      if (n) stack.push(...n.children);
    }

    const updatedNodes: Record<string, FileNode> = {};
    for (const [id, n] of Object.entries(template.nodes)) {
      if (!toDelete.has(id)) updatedNodes[id] = n;
    }

    // Retirer références côté parent
    if (node.parent && updatedNodes[node.parent]) {
      updatedNodes[node.parent] = {
        ...updatedNodes[node.parent],
        children: updatedNodes[node.parent].children.filter(
          (cid) => !toDelete.has(cid)
        ),
      };
    }

    // Nettoyer racines
    const updatedRoot = template.rootNodes.filter((rid) => !toDelete.has(rid));

    onTemplateChange({
      ...template,
      nodes: updatedNodes,
      rootNodes: updatedRoot,
    });
    setSelectedNode(null);
    setNodeName("");
    setChildName("");
  };

  const exportTemplate = () => {
    if (!template) return;
    const dataStr = JSON.stringify(template, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const templateData = JSON.parse(e.target?.result as string);
        onTemplateChange(templateData);
      } catch {
        alert("Erreur lors de l'importation du modèle");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      style={{
        ...teStyles.grid,
        gridTemplateColumns: isMobile ? "1fr" : "4fr 1fr",
        gap: isMobile ? 0 : teStyles.grid.gap,
        alignItems: isMobile ? undefined : "stretch",
      }}
    >
      <div
        ref={graphCardRef}
        className="card card-no-mb-desktop"
        style={{
          display: "flex",
          flexDirection: "column",
          height: cardHeight,
        }}
      >
        {/* Barre d'outils (Import / Export) déplacée ici */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={exportTemplate}
            className="btn btn-success btn-compact"
            title="Exporter le modèle"
          >
            <Download size={14} /> Exporter
          </button>
          <label
            className="btn btn-primary btn-compact file-label"
            title="Importer un modèle"
            style={{ cursor: "pointer" }}
          >
            <input
              type="file"
              accept=".json"
              onChange={importTemplate}
              hidden
            />
            <Upload size={14} /> Importer
          </label>
        </div>
        {/* Visualisation du graphe */}
        <div
          style={{
            ...teStyles.graphWrapper,
            flex: 1,
            minHeight: isMobile ? 400 : 400,
          }}
        >
          <svg ref={svgRef} style={{ ...teStyles.graph, height: "100%" }} />
        </div>
        <div style={teStyles.legend} className="no-last-mb graph-legend">
          <p>• Bleu: Dossiers | Vert: Fichiers</p>
        </div>
      </div>
      <div>
        <div className="card">
          <h3 className="card-subtitle">
            {selectedNode
              ? "Modifier / Gérer le nœud"
              : "Ajouter un nœud racine"}
          </h3>
          <div className="v-stack md">
            {/* Section ajout racine OU édition */}
            <div className="v-stack sm">
              <div>
                <label className="form-label">Nom</label>
                <input
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  className="input"
                  placeholder={
                    selectedNode ? "Nom du nœud" : "Nom du nœud racine"
                  }
                />
              </div>
              <div>
                <label className="form-label">Type</label>
                <select
                  value={nodeType}
                  onChange={(e) =>
                    setNodeType(e.target.value as "file" | "directory")
                  }
                  className="select"
                >
                  <option value="directory">Dossier</option>
                  <option value="file">Fichier</option>
                </select>
              </div>
              {!selectedNode && (
                <button
                  onClick={addNode}
                  className="btn btn-success"
                  disabled={!nodeName}
                >
                  Ajouter racine
                </button>
              )}
            </div>

            {selectedNode && (
              <>
                <div className="v-stack sm">
                  <h4 style={{ margin: 0 }}>Ajouter un enfant</h4>
                  <div>
                    <label className="form-label">Nom enfant</label>
                    <input
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      className="input"
                      placeholder="Nom de l'enfant"
                    />
                  </div>
                  <div>
                    <label className="form-label">Type enfant</label>
                    <select
                      value={childType}
                      onChange={(e) =>
                        setChildType(e.target.value as "file" | "directory")
                      }
                      className="select"
                    >
                      <option value="directory">Dossier</option>
                      <option value="file">Fichier</option>
                    </select>
                  </div>
                  <button
                    onClick={addChildNode}
                    className="btn btn-success"
                    disabled={!childName}
                  >
                    Ajouter enfant
                  </button>
                </div>
                <div className="v-stack sm">
                  <h4 style={{ margin: 0 }}>Danger</h4>
                  <button
                    onClick={deleteSelectedNode}
                    className="btn btn-danger"
                  >
                    Supprimer le nœud
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
