/**
 * Options de création d'un nœud dans le modèle hiérarchique.
 * - `parentId`: identifiant du parent sous lequel insérer le nœud. Si omis ou null, la racine est utilisée.
 */
export interface CreateNodeOptions {
  /** Identifiant du parent. Si undefined ou null => rattachement à la racine. */
  parentId?: string | null;
}
