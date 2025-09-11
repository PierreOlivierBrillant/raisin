// Représente un nœud (fichier ou dossier) dans la hiérarchie.
export interface FileNode {
  id: string;
  name: string;
  type: "file" | "directory";
  path: string;
  parent?: string;
  children: string[];
  matchScore?: number;
}
