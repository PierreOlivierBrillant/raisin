/** Représentation hiérarchique sérialisable en YAML. */
export interface YamlNode {
  /** Nom du fichier ou dossier. */
  name: string;
  /** Type de nœud. */
  type: "file" | "directory";
  /** Enfants (présents uniquement pour les dossiers). */
  children?: YamlNode[];
}

/**
 * Structure enveloppe des modèles sérialisés.
 *
 * Historiquement un seul nœud racine était pris en charge (clé `root`).
 * Pour assurer la rétrocompatibilité, on conserve cette clé tout en ajoutant
 * `roots` qui peut contenir plusieurs racines simultanées.
 */
export interface YamlHierarchy {
  /** Ancien champ racine unique (support lecture/écriture pour compat). */
  root?: YamlNode;
  /** Nouvelle liste de racines. */
  roots?: YamlNode[];
}
