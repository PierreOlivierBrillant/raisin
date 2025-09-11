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
    const sim = simulationRef.current as d3.Simulation<GraphNode, undefined>;
    const nodes = sim.nodes();
    const root = nodes.find((n) => n.id === rootId);
    if (root) {
      root.fx = w / 2;
      root.fy = h / 2;
      root.x = w / 2;
      root.y = h / 2;
      root.vx = 0;
      root.vy = 0;
    }
    simulationRef.current.alpha(0.25).restart();
    setTimeout(
      () => simulationRef.current && simulationRef.current.alphaTarget(0),
      220
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

    const NODE_RADIUS = 32;
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
    const targets: Record<string, { x: number; y: number }> = {};
    if (root) {
      root.descendants().forEach((d) => {
        const angle = (d.x ?? 0) - Math.PI / 2; // 0 en haut
        const r = d.y ?? 0;
        targets[d.data.id] = {
          x: width / 2 + Math.cos(angle) * r,
          y: height / 2 + Math.sin(angle) * r,
        };
      });
    }

    // Initialiser positions des nœuds avec légère perturbation pour une animation douce
    nodeData.forEach((n) => {
      const t = targets[n.id] || { x: width / 2, y: height / 2 };
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
          .distance(80)
          .strength(0.9)
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(-140))
      .force(
        "collision",
        d3
          .forceCollide<GraphNode>()
          .radius(NODE_RADIUS + 8)
          .strength(0.9)
      )
      .force(
        "x",
        d3
          .forceX<GraphNode>()
          .x((d) => targets[d.id]?.x ?? width / 2)
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
        rootNode.fx = width / 2;
        rootNode.fy = height / 2;
      }
    }

    const linkSel = svg
      .append("g")
      .selectAll("line")
      .data(linkData)
      .enter()
      .append("line")
      .attr("stroke", "#9CA3AF")
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.6);

    const nodeSel = svg
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
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (d.id === primaryRootId) return;
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeSel
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", (d) => (d.type === "directory" ? "#3B82F6" : "#10B981"))
      .attr("stroke", "#FFF")
      .attr("stroke-width", 2)
      .on("click", (_, d) => {
        onSelectNodeRef.current(d.id, { name: d.name, type: d.type });
      });

    const MAX_LABEL = 12;
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
      .attr("font-size", "12px")
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
      linkSel
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);
      nodeSel.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    simulationRef.current = simulation;
    recenterRoot();
  }, [template, recenterRoot]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    // Mise à jour du contour des cercles selon la sélection
    svg
      .selectAll<SVGCircleElement, GraphNode>("g.te-node > circle")
      .attr("stroke", function (d) {
        return selectedNode && d.id === selectedNode ? "#EF4444" : "#FFF";
      })
      .attr("stroke-width", function (d) {
        return selectedNode && d.id === selectedNode ? 3 : 2;
      });
  }, [selectedNode]);

  useEffect(() => {
    recenterRoot();
  }, [layoutVersion, recenterRoot]);

  useEffect(() => {
    if (!svgRef.current) return;
    const parent = svgRef.current.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => recenterRoot());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [recenterRoot]);

  return <svg ref={svgRef} style={graphCanvasStyles.svg} />;
};
