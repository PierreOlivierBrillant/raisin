import type { FileNode } from "./FileNode";

// Modèle décrivant l'arbre attendu.
export interface HierarchyTemplate {
  id: string;
  name: string;
  description: string;
  nodes: Record<string, FileNode>;
  rootNodes: string[];
}
