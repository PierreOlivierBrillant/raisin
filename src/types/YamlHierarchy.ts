/** Représentation hiérarchique sérialisable en YAML. */
export interface YamlNode {
  /** Nom du fichier ou dossier (la racine est toujours forcée à « Racine »). */
  name: string;
  /** Type de nœud. */
  type: "file" | "directory";
  /** Enfants (présents uniquement pour les dossiers). */
  children?: YamlNode[];
}

/** Enveloppe contenant la racine unique de l'arborescence lors de l'export/import YAML. */
export interface YamlHierarchy {
  /** Nœud racine unique. */
  root: YamlNode;
}
