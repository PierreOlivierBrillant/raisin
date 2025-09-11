import type {
  FileNode,
  HierarchyTemplate,
  CreateNodeOptions,
  YamlHierarchy,
  YamlNode,
} from "../../types";

/**
 * Fonctions utilitaires pour la gestion d'un modèle hiérarchique (arborescence de fichiers/dossiers)
 * dans l'éditeur de modèle. Toutes les fonctions sont PURES (elles ne mutent pas l'objet d'entrée)
 * et retournent un nouveau `HierarchyTemplate` lorsque nécessaire.
 *
 * Invariants garantis :
 * - Il existe toujours exactement un nœud racine dont l'identifiant est `rootNodes[0]`.
 * - Le nœud racine est toujours de type `directory` et porte le nom affiché « Racine ».
 */

/**
 * Génère un identifiant pseudo‑unique pour un nœud.
 * Combinaison timestamp + segment aléatoire base36 afin de réduire les collisions rapides.
 * (Suffisant pour un usage client éphémère — pas destiné à être un UUID cryptographiquement sûr.)
 */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Crée un modèle hiérarchique minimal contenant uniquement la racine.
 * @returns Un `HierarchyTemplate` valide avec la racine initialisée.
 */
export function createDefaultTemplate(): HierarchyTemplate {
  const rootId = "root";
  const nodes: Record<string, FileNode> = {
    [rootId]: {
      id: rootId,
      name: "Racine",
      type: "directory",
      path: "Racine",
      children: [],
    },
  };
  return {
    id: "default",
    name: "Modèle",
    description: "Modèle avec racine fixe",
    nodes,
    rootNodes: [rootId],
  };
}

/**
 * Normalise la racine : garantit son existence, son type `directory` et le nom « Racine ».
 * Retourne un modèle corrigé ou un modèle minimal si la racine est invalide/absente.
 */
export function ensureRootInvariant(
  template: HierarchyTemplate
): HierarchyTemplate {
  // Si pas de racine on repart d'un modèle propre
  if (!template.rootNodes || template.rootNodes.length === 0)
    return createDefaultTemplate();
  const rootId = template.rootNodes[0];
  const root = template.nodes[rootId];
  if (!root) return createDefaultTemplate();
  const updatedRoot: FileNode = { ...root, name: "Racine", type: "directory" };
  return {
    ...template,
    nodes: { ...template.nodes, [rootId]: updatedRoot },
    rootNodes: [rootId],
  };
}

/**
 * Indique si l'identifiant fourni correspond à la racine active du modèle.
 */
function isRoot(template: HierarchyTemplate, nodeId: string): boolean {
  return template.rootNodes[0] === nodeId;
}

//

/**
 * Crée un nouveau nœud (fichier ou dossier) sous un parent donné.
 * Si `parentId` est omis, le nœud est ajouté directement sous la racine.
 * @param template Modèle courant (non muté).
 * @param name Nom du nœud à créer.
 * @param type Type du nœud (file | directory).
 * @param options.parentId Identifiant du parent; facultatif.
 * @returns Nouveau modèle avec le nœud inséré. Retourne le modèle original si le parent est introuvable.
 */
export function createNode(
  template: HierarchyTemplate,
  name: string,
  type: FileNode["type"],
  { parentId }: CreateNodeOptions = {}
): HierarchyTemplate {
  const id = generateNodeId();
  const nodes: Record<string, FileNode> = { ...template.nodes };
  const rootId = template.rootNodes[0];
  const effectiveParent = parentId ?? rootId; // si parent absent => attacher à la racine
  const parent = nodes[effectiveParent];
  if (!parent) return template;
  const newNode: FileNode = {
    id,
    name,
    type,
    path: `${parent.path}/${name}`,
    parent: effectiveParent,
    children: [],
  };
  nodes[id] = newNode;
  nodes[effectiveParent] = { ...parent, children: [...parent.children, id] };
  return { ...template, nodes };
}

/**
 * Met à jour les attributs simples (nom, type) d'un nœud.
 * La racine est protégée et ne peut être modifiée.
 * @param template Modèle source.
 * @param nodeId Identifiant du nœud cible.
 * @param attrs Sous‑ensemble de champs à appliquer (name, type).
 * @returns Nouveau modèle si modification effective, sinon `null`.
 */
export function updateNodeAttributes(
  template: HierarchyTemplate,
  nodeId: string,
  attrs: Partial<Pick<FileNode, "name" | "type">>
): HierarchyTemplate | null {
  if (isRoot(template, nodeId)) return null; // racine immuable
  const current = template.nodes[nodeId];
  if (!current) return null;
  const next = { ...current, ...attrs };
  if (next.name === current.name && next.type === current.type) return null;
  return { ...template, nodes: { ...template.nodes, [nodeId]: next } };
}

/**
 * Calcule l'ensemble des identifiants descendants (en profondeur) à partir d'un nœud incluant celui‑ci.
 * @param template Modèle hiérarchique.
 * @param startId Nœud de départ.
 * @returns Un Set contenant tous les identifiants (startId inclus). Les identifiants inexistants sont ignorés.
 */
export function collectDescendants(
  template: HierarchyTemplate,
  startId: string
): Set<string> {
  const toDelete = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop()!;
    if (toDelete.has(id)) continue;
    toDelete.add(id);
    const n = template.nodes[id];
    if (n) stack.push(...n.children);
  }
  return toDelete;
}

export function deleteNodeAndDescendants(
  template: HierarchyTemplate,
  nodeId: string
): HierarchyTemplate | null {
  // On interdit la suppression de la racine pour conserver l'invariant global.
  if (isRoot(template, nodeId)) return null; // suppression racine interdite
  if (!template.nodes[nodeId]) return null;
  const toDelete = collectDescendants(template, nodeId);
  const nodes: Record<string, FileNode> = {};
  for (const [id, n] of Object.entries(template.nodes)) {
    if (!toDelete.has(id)) nodes[id] = n;
  }
  const original = template.nodes[nodeId];
  if (original.parent && nodes[original.parent]) {
    const parent = nodes[original.parent];
    nodes[original.parent] = {
      ...parent,
      children: parent.children.filter((cid) => !toDelete.has(cid)),
    };
  }
  return { ...template, nodes };
}

// =========================
//  Sérialisation YAML (hiérarchie imbriquée)
// =========================

//

/**
 * Construit une représentation hiérarchique sérialisable en YAML (racine forcée: nom « Racine », type directory).
 * @returns Objet prêt pour la sérialisation YAML.
 */
export function toYamlHierarchy(template: HierarchyTemplate): YamlHierarchy {
  const rootId = template.rootNodes[0];
  const rootNode = template.nodes[rootId];
  if (!rootNode) {
    return { root: { name: "Racine", type: "directory" } };
  }

  function build(id: string): YamlNode | null {
    const n = template.nodes[id];
    if (!n) return null;
    if (n.type === "file") {
      return { name: n.name, type: "file" };
    }
    // directory
    const children = (n.children || [])
      .map((cid) => build(cid))
      .filter((c): c is YamlNode => !!c);
    const node: YamlNode = { name: n.name, type: "directory" };
    if (children.length) node.children = children;
    return node;
  }

  const rootYaml = build(rootId) || { name: "Racine", type: "directory" };
  // Normalisation explicite de la racine
  rootYaml.name = "Racine";
  rootYaml.type = "directory";
  return { root: rootYaml };
}

/**
 * Reconstruit un `HierarchyTemplate` interne à partir d'une structure hiérarchique issue du YAML.
 * Applique les invariants : identifiant de la racine fixé à "root", nom forcé à « Racine », type forcé à `directory`.
 * Génère un nouvel identifiant pour chaque nœud non racine.
 * Ignore silencieusement les enfants invalides (nom manquant ou type absent).
 * @param yamlStruct Structure issue de la désérialisation YAML.
 * @returns Un modèle valide prêt à être utilisé dans l'éditeur.
 */
export function fromYamlHierarchy(
  yamlStruct: YamlHierarchy
): HierarchyTemplate {
  const rootYaml = yamlStruct.root;
  // Création du conteneur de nœuds
  const nodes: Record<string, FileNode> = {};
  const rootId = "root";

  function addNode(
    yNode: YamlNode,
    parentId: string | null,
    parentPath: string
  ): string {
    const id = parentId ? generateNodeId() : rootId; // racine id fixe
    const safeName = parentId ? yNode.name : "Racine"; // forcer nom racine
    const type: FileNode["type"] = parentId ? yNode.type : "directory"; // forcer type racine
    const path = parentId ? `${parentPath}/${safeName}` : safeName;
    const fileNode: FileNode = {
      id,
      name: safeName,
      type,
      path,
      parent: parentId || undefined,
      children: [],
    };
    nodes[id] = fileNode;

    if (
      type === "directory" &&
      yNode.children &&
      Array.isArray(yNode.children)
    ) {
      for (const child of yNode.children) {
        // Ignorer enfants invalides
        if (!child || typeof child.name !== "string" || !child.type) continue;
        const childId = addNode(child, id, path);
        nodes[id] = {
          ...nodes[id],
          children: [...nodes[id].children, childId],
        };
      }
    }
    return id;
  }

  addNode(rootYaml, null, "");

  return ensureRootInvariant({
    id: "imported",
    name: "Modèle importé",
    description: "Importé depuis YAML",
    nodes,
    rootNodes: [rootId],
  });
}
