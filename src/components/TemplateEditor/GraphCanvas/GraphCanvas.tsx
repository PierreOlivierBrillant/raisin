import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { HierarchyTemplate } from "../../../types/HierarchyTemplate";
import type { FileNode } from "../../../types/FileNode";
import { graphCanvasStyles } from "./GraphCanvas.styles";

interface GraphCanvasProps {
  template: HierarchyTemplate;
  selectedNode: string | null;
  onSelectNode: (
    id: string | null,
    meta?: { name: string; type: FileNode["type"] }
  ) => void;
  layoutVersion?: number;
}

type GraphNode = FileNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  template,
  selectedNode,
  onSelectNode,
  layoutVersion,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(
    null
  );
  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    if (svgRef.current) {
      containerRef.current = svgRef.current.parentElement as HTMLElement | null;
    }
  }, []);

  const recenterRoot = useCallback(() => {
    if (!simulationRef.current || !svgRef.current || !template.rootNodes.length)
      return;
    const rootId = template.rootNodes[0];
    const w = svgRef.current.getBoundingClientRect().width;
    const h = svgRef.current.getBoundingClientRect().height;
    const centerX = w / 2; // centre stable (on animera une translation globale pour le push)
    const sim = simulationRef.current as d3.Simulation<GraphNode, undefined>;
    const nodes = sim.nodes();
    const root = nodes.find((n) => n.id === rootId);
    if (root) {
      root.fx = centerX;
      root.fy = h / 2;
      root.x = centerX;
      root.y = h / 2;
      root.vx = 0;
      root.vy = 0;
      // Correction mineure si root a déjà dérivé (cas rares après ticks)
      const driftX = Math.abs((root.x || 0) - centerX);
      const driftY = Math.abs((root.y || 0) - h / 2);
      if (driftX > 4 || driftY > 4) {
        root.x = centerX;
        root.y = h / 2;
        root.fx = centerX;
        root.fy = h / 2;
      }
    }
    simulationRef.current.alpha(0.12).restart();
    setTimeout(
      () => simulationRef.current && simulationRef.current.alphaTarget(0),
      180
    );
  }, [template.rootNodes]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.getBoundingClientRect().width || 800;
    const container = svgRef.current.parentElement;
    const height = container ? container.clientHeight : 500;
    svg.attr("width", width).attr("height", height);
    const centerX = width / 2; // ne dépend plus de panelOpen

    const nodeData: GraphNode[] = Object.values(template.nodes).map((n) => ({
      ...n,
    })) as GraphNode[];
    const linkData: GraphLink[] = [];
    nodeData.forEach((n) =>
      n.children.forEach((cid) =>
        linkData.push({ source: n.id, target: cid } as GraphLink)
      )
    );

    const primaryRootId =
      template.rootNodes && template.rootNodes.length > 0
        ? template.rootNodes[0]
        : nodeData.find((n) => !n.parent)?.id;
    // root node déjà implicitement positionné par le layout cluster

    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("click", () => onSelectNodeRef.current(null));

    const NODE_RADIUS = 44; // agrandi (32 précédemment)
    // Hiérarchie pour calculer des positions radiales cibles (structure stable)
    interface HNode {
      id: string;
      name: string;
      type: FileNode["type"];
      children?: HNode[];
    }
    const buildHierarchy = (id: string): HNode => {
      const n = template.nodes[id];
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        children: n.children.map((c) => buildHierarchy(c)),
      };
    };
    const hRoot = primaryRootId ? buildHierarchy(primaryRootId) : null;
    const root = hRoot ? d3.hierarchy<HNode>(hRoot, (d) => d.children) : null;
    const radius = Math.min(width, height) / 2 - 40;
    const cluster = d3
      .cluster<HNode>()
      .size([2 * Math.PI, Math.max(radius, NODE_RADIUS * 4)]);
    if (root) cluster(root);

    // Mapping profondeur -> id pour moduler la couleur par distance à la racine
    const depthMap: Record<string, number> = {};
    let maxDepth = 1;
    if (root) {
      root.descendants().forEach((d) => {
        depthMap[d.data.id] = d.depth;
        if (d.depth > maxDepth) maxDepth = d.depth;
      });
    }
    const targets: Record<string, { x: number; y: number }> = {};
    if (root) {
      root.descendants().forEach((d) => {
        const angle = (d.x ?? 0) - Math.PI / 2; // 0 en haut
        const r = d.y ?? 0;
        targets[d.data.id] = {
          x: centerX + Math.cos(angle) * r,
          y: height / 2 + Math.sin(angle) * r,
        };
      });
    }

    // Initialiser positions des nœuds avec légère perturbation pour une animation douce
    nodeData.forEach((n) => {
      const t = targets[n.id] || { x: centerX, y: height / 2 };
      n.x = t.x + (Math.random() - 0.5) * 20;
      n.y = t.y + (Math.random() - 0.5) * 20;
    });

    const simulation = d3
      .forceSimulation<GraphNode>(nodeData)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(linkData)
          .id((d) => d.id)
          // distance augmentée pour compenser l'augmentation du rayon
          .distance(100)
          .strength(0.9)
      )
      .force(
        "charge",
        d3
          .forceManyBody<GraphNode>()
          // charge un peu plus négative pour espacer les plus gros nœuds
          .strength(-160)
      )
      .force(
        "collision",
        d3
          .forceCollide<GraphNode>()
          .radius(NODE_RADIUS + 10)
          .strength(0.95)
      )
      .force(
        "x",
        d3
          .forceX<GraphNode>()
          .x((d) => targets[d.id]?.x ?? centerX)
          .strength((d) => (d.id === primaryRootId ? 1 : 0.15))
      )
      .force(
        "y",
        d3
          .forceY<GraphNode>()
          .y((d) => targets[d.id]?.y ?? height / 2)
          .strength((d) => (d.id === primaryRootId ? 1 : 0.15))
      );

    // Fixer la racine au centre
    if (primaryRootId) {
      const rootNode = nodeData.find((n) => n.id === primaryRootId);
      if (rootNode) {
        rootNode.fx = centerX;
        rootNode.fy = height / 2;
      }
    }

    // Groupe racine pour animation de translation globale (push latéral)
    const sceneG = svg.append("g").attr("class", "te-scene");

    const linkSel = sceneG
      .append("g")
      .selectAll("line")
      .data(linkData)
      .enter()
      .append("line")
      .attr("stroke", "#9CA3AF")
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.6);

    const nodeSel = sceneG
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g.te-node")
      .data(nodeData)
      .enter()
      .append("g")
      .attr("class", "te-node")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (d.id === primaryRootId) return; // racine immobile
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            if (d.id === primaryRootId) return;
            // Clamp pendant le drag
            const w = svgRef.current?.getBoundingClientRect().width || width;
            const h = svgRef.current?.getBoundingClientRect().height || height;
            const minX = NODE_RADIUS;
            const maxX = w - NODE_RADIUS;
            const minY = NODE_RADIUS;
            const maxY = h - NODE_RADIUS;
            const cx = Math.max(minX, Math.min(maxX, event.x));
            const cy = Math.max(minY, Math.min(maxY, event.y));
            d.fx = cx;
            d.fy = cy;
          })
          .on("end", (event, d) => {
            if (d.id === primaryRootId) return;
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const colorFor = (d: GraphNode) => {
      if (d.id === primaryRootId) return "#EF4444";
      const depth = depthMap[d.id] ?? 0;
      if (depth === 0) {
        return d.type === "directory" ? "#3B82F6" : "#10B981";
      }
      const t = maxDepth > 0 ? depth / maxDepth : 0; // 0 -> proche racine, 1 -> plus loin
      const base =
        d.type === "directory" ? d3.hsl("#3B82F6") : d3.hsl("#10B981");
      // Désaturation progressive et éclaircissement
      const s = base.s * (1 - 0.55 * t); // réduit saturation jusqu'à -55%
      const l = base.l + (1 - base.l) * 0.45 * t; // augmente la luminosité jusqu'à +45% du potentiel restant
      base.s = Math.max(0, Math.min(1, s));
      base.l = Math.max(0, Math.min(1, l));
      return base.formatHex();
    };

    nodeSel
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", (d) => colorFor(d))
      .attr("stroke", (d) => (d.id === primaryRootId ? "#7F1D1D" : "#FFF"))
      .attr("stroke-width", (d) => (d.id === primaryRootId ? 3 : 2))
      .on("click", (_, d) => {
        onSelectNodeRef.current(d.id, { name: d.name, type: d.type });
      });

    const MAX_LABEL = 14; // un peu plus de place dans un cercle plus grand
    nodeSel
      .append("text")
      .text((d) =>
        d.name.length > MAX_LABEL
          ? d.name.slice(0, MAX_LABEL - 1) + "…"
          : d.name
      )
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "#111827")
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .style("pointer-events", "none");
    nodeSel.append("title").text((d) => d.name);

    simulation.on("tick", () => {
      // Re-fixer la racine
      if (primaryRootId) {
        const rootNode = nodeData.find((n) => n.id === primaryRootId);
        if (rootNode && svgRef.current) {
          const w = svgRef.current.getBoundingClientRect().width;
          const h = svgRef.current.getBoundingClientRect().height;
          rootNode.x = rootNode.fx = w / 2;
          rootNode.y = rootNode.fy = h / 2;
          rootNode.vx = 0;
          rootNode.vy = 0;
        }
      }

      // Dimensions courantes pour clamp
      const curW = svgRef.current?.getBoundingClientRect().width || width;
      const curH = svgRef.current?.getBoundingClientRect().height || height;
      const minX = NODE_RADIUS;
      const maxX = curW - NODE_RADIUS; // on ne décale plus le clamp; translation globale gère le push
      const minY = NODE_RADIUS;
      const maxY = curH - NODE_RADIUS;

      nodeData.forEach((n) => {
        if (n.id === primaryRootId) return; // déjà géré
        if (n.x == null || n.y == null) return;
        let clamped = false;
        if (n.x < minX) {
          n.x = minX;
          n.vx = 0;
          clamped = true;
        } else if (n.x > maxX) {
          n.x = maxX;
          n.vx = 0;
          clamped = true;
        }
        if (n.y < minY) {
          n.y = minY;
          n.vy = 0;
          clamped = true;
        } else if (n.y > maxY) {
          n.y = maxY;
          n.vy = 0;
          clamped = true;
        }
        if (clamped && n.fx != null && n.fy != null) {
          // si l'utilisateur maintient un drag, maintenir le clamp
          n.fx = Math.max(minX, Math.min(maxX, n.fx));
          n.fy = Math.max(minY, Math.min(maxY, n.fy));
        }
      });
      linkSel
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);
      nodeSel.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
      // applique la translation globale
      // Plus de translation globale : l'espace latéral est désormais réservé par padding-right
      // sceneG.attr("transform", `translate(${offsetRef.current},0)`);
    });

    simulationRef.current = simulation;
    recenterRoot();
    // Recentrage différé pour stabiliser après les premiers ticks
    setTimeout(() => recenterRoot(), 60);
    setTimeout(() => recenterRoot(), 140);
  }, [template, recenterRoot, layoutVersion]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    // Mise à jour du contour des cercles selon la sélection
    svg
      .selectAll<SVGCircleElement, GraphNode>("g.te-node > circle")
      .attr("stroke", function (d) {
        if (d.id === template.rootNodes[0]) return "#7F1D1D"; // root conserve son contour sombre
        return selectedNode && d.id === selectedNode ? "#EF4444" : "#FFF";
      })
      .attr("stroke-width", function (d) {
        if (d.id === template.rootNodes[0]) return 3;
        return selectedNode && d.id === selectedNode ? 3 : 2;
      });
  }, [selectedNode, template.rootNodes]);

  useEffect(() => {
    recenterRoot();
  }, [layoutVersion, recenterRoot]);

  // Translation globale désactivée : on centre la racine sur la zone réellement disponible.

  useEffect(() => {
    if (!svgRef.current) return;
    const parent = svgRef.current.parentElement;
    if (!parent) return;
    const svgEl = svgRef.current;
    const updateSize = () => {
      if (!svgEl || !parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      d3.select(svgEl).attr("width", w).attr("height", h);
      recenterRoot();
    };
    const ro = new ResizeObserver(updateSize);
    ro.observe(parent);
    const mo = new MutationObserver(updateSize);
    mo.observe(parent, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    // Premier ajustement post-macro-tâche pour laisser le layout se stabiliser
    requestAnimationFrame(() => updateSize());
    setTimeout(updateSize, 60);
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [recenterRoot]);

  return (
    <svg ref={svgRef} style={{ ...graphCanvasStyles.svg, height: "100%" }} />
  );
};
