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
  // Conserver la dernière version de onSelectNode pour éviter de rebâtir le graphe à chaque render
  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    if (svgRef.current) {
      containerRef.current = svgRef.current.parentElement as HTMLElement | null;
    }
  }, []);

  const recenterRoot = useCallback(
    (soft: boolean = false) => {
      if (
        !svgRef.current ||
        !simulationRef.current ||
        !template.rootNodes.length
      )
        return;
      const svgEl = svgRef.current;
      const width = svgEl.getBoundingClientRect().width;
      const height = svgEl.getBoundingClientRect().height;
      if (!width || !height) return;
      const rootId = template.rootNodes[0];
      const simAny = simulationRef.current as unknown as {
        nodes: () => GraphNode[];
      };
      const nodesArr = simAny.nodes();
      const root = nodesArr.find((n) => n.id === rootId);
      if (!root) return;
      root.fx = width / 2;
      root.fy = height / 2;
      root.x = width / 2;
      root.y = height / 2;
      if (!soft) {
        simulationRef.current.alpha(0.6).restart();
        setTimeout(
          () => simulationRef.current && simulationRef.current.alphaTarget(0),
          250
        );
      } else {
        simulationRef.current.alphaTarget(0.3).restart();
        setTimeout(
          () => simulationRef.current && simulationRef.current.alphaTarget(0),
          200
        );
      }
    },
    [template.rootNodes]
  );

  // Construction / reconstruction du graphe uniquement quand la structure (template) change
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.getBoundingClientRect().width || 800;
    const container = svgRef.current.parentElement;
    const height = container ? container.clientHeight : 500;
    svg.attr("width", width).attr("height", height);

    // Clone des nœuds pour empêcher D3 de muter l'état source (x,y,vx,vy,fx,fy)
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
    const isRoot = (d: GraphNode) => d.id === primaryRootId;
    const rootNode = nodeData.find((n) => n.id === primaryRootId);
    if (rootNode) {
      rootNode.fx = width / 2;
      rootNode.fy = height / 2;
    }

    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("click", () => onSelectNodeRef.current(null));

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
          .on("start", (event, d) => {
            if (isRoot(d)) return;
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            if (isRoot(d)) return;
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (isRoot(d)) return;
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodes
      .append("circle")
      .attr("r", 25)
      .attr("fill", (d) => (d.type === "directory" ? "#3B82F6" : "#10B981"))
      .attr("stroke", "#FFF")
      .attr("stroke-width", 2)
      .on("click", (_, d) => {
        onSelectNodeRef.current(d.id, { name: d.name, type: d.type });
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

    simulation.on("tick", () => {
      links
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);
      nodes.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
    simulationRef.current = simulation;
    // recentrage initial
    recenterRoot(false);
  }, [template, recenterRoot]);

  // Mise à jour visuelle (highlight) quand selectedNode change, sans rebâtir le graphe
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    svg
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .attr("stroke", (d) =>
        selectedNode && d.id === selectedNode ? "#EF4444" : "#FFF"
      )
      .attr("stroke-width", (d) =>
        selectedNode && d.id === selectedNode ? 3 : 2
      );
  }, [selectedNode]);

  // Recentrage du nœud racine lors des changements de layout (ex panneau qui modifie largeur)
  useEffect(() => {
    // Layout version change (ex panneau) => recenter après transition (soft = true)
    const t = setTimeout(() => recenterRoot(true), 300);
    return () => clearTimeout(t);
  }, [layoutVersion, recenterRoot]);

  // ResizeObserver pour recenter sur redimensionnement du conteneur
  useEffect(() => {
    if (!svgRef.current) return;
    const parent = svgRef.current.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => recenterRoot(true));
    ro.observe(parent);
    return () => ro.disconnect();
  }, [recenterRoot]);

  return <svg ref={svgRef} style={graphCanvasStyles.svg} />;
};
