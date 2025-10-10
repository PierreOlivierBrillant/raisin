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
 * - Le tableau `rootNodes` référence uniquement des identifiants existants.
 * - Chaque racine est de type `directory`.
 * - Les chemins (`path`) sont cohérents pour chaque nœud (concaténation du
 *   chemin parent et du nom courant, ou nom seul pour une racine).
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
  if (!template.rootNodes || template.rootNodes.length === 0) {
    return createDefaultTemplate();
  }

  let nextNodes: Record<string, FileNode> = { ...template.nodes };
  const validRootIds: string[] = [];
  const seenNames = new Set<string>();

  for (const rootId of template.rootNodes) {
    const node = nextNodes[rootId];
    if (!node) continue;
    const baseName = node.name?.trim() || "Racine";
    let finalName = baseName;
    let suffix = 2;
    while (seenNames.has(finalName.toLowerCase())) {
      finalName = `${baseName} (${suffix})`;
      suffix++;
    }
    seenNames.add(finalName.toLowerCase());
    nextNodes[rootId] = {
      ...node,
      name: finalName,
      type: "directory",
      parent: undefined,
      children: [...node.children],
    };
    nextNodes = propagatePaths(nextNodes, rootId);
    validRootIds.push(rootId);
  }

  if (!validRootIds.length) {
    return createDefaultTemplate();
  }

  return {
    ...template,
    nodes: nextNodes,
    rootNodes: validRootIds,
  };
}

/**
 * Indique si l'identifiant fourni correspond à la racine active du modèle.
 */
function isRoot(template: HierarchyTemplate, nodeId: string): boolean {
  return template.rootNodes.includes(nodeId);
}

function propagatePaths(
  nodes: Record<string, FileNode>,
  startId: string
): Record<string, FileNode> {
  const next: Record<string, FileNode> = { ...nodes };
  const stack: string[] = [startId];
  while (stack.length) {
    const id = stack.pop()!;
    const current = next[id];
    if (!current) continue;
    const parentPath = current.parent ? next[current.parent]?.path ?? "" : "";
    const expectedPath = parentPath
      ? `${parentPath}/${current.name}`
      : current.name;
    if (current.path !== expectedPath) {
      next[id] = { ...current, path: expectedPath };
    }
    const children = next[id]?.children ?? [];
    for (const childId of children) stack.push(childId);
  }
  return next;
}

function ensureUniqueRootName(
  template: HierarchyTemplate,
  candidate: string,
  excludeId?: string
): string {
  const existing = template.rootNodes
    .filter((id) => id !== excludeId)
    .map((id) => template.nodes[id]?.name.toLowerCase())
    .filter(Boolean);
  if (!existing.length) return candidate;
  const base = candidate.trim() || "Racine";
  let finalName = base;
  let suffix = 2;
  while (existing.includes(finalName.toLowerCase())) {
    finalName = `${base} (${suffix})`;
    suffix++;
  }
  return finalName;
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
  const effectiveParent = parentId ?? rootId;
  const parent = nodes[effectiveParent];
  if (!parent) return template;
  const parentPath = parent.path || parent.name;
  const newNode: FileNode = {
    id,
    name,
    type,
    path: parentPath ? `${parentPath}/${name}` : name,
    parent: effectiveParent,
    children: [],
  };
  nodes[id] = newNode;
  nodes[effectiveParent] = { ...parent, children: [...parent.children, id] };
  const updatedNodes = propagatePaths(nodes, id);
  return { ...template, nodes: updatedNodes };
}

export function addRootNode(
  template: HierarchyTemplate,
  desiredName: string
): { template: HierarchyTemplate; rootId: string } {
  const rootId = generateNodeId();
  const safeName = desiredName.trim() || "Racine";
  const nodes: Record<string, FileNode> = { ...template.nodes };
  const uniqueName = ensureUniqueRootName(template, safeName);
  const rootNode: FileNode = {
    id: rootId,
    name: uniqueName,
    type: "directory",
    path: uniqueName,
    children: [],
  };
  nodes[rootId] = rootNode;
  const updatedTemplate: HierarchyTemplate = {
    ...template,
    nodes,
    rootNodes: [...template.rootNodes, rootId],
  };
  const normalized = ensureRootInvariant(updatedTemplate);
  return { template: normalized, rootId };
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
  const current = template.nodes[nodeId];
  if (!current) return null;
  const isRootNode = isRoot(template, nodeId);
  const providedName = attrs.name !== undefined ? attrs.name : current.name;
  const trimmedName =
    typeof providedName === "string" ? providedName.trim() : current.name;
  const desiredName = trimmedName || (isRootNode ? "" : trimmedName);
  if (!isRootNode && !desiredName) {
    return null;
  }

  let desiredType = attrs.type ?? current.type;
  if (isRootNode) {
    desiredType = "directory";
    const duplicate = template.rootNodes
      .filter((id) => id !== nodeId)
      .some(
        (id) =>
          template.nodes[id]?.name.toLowerCase() === desiredName.toLowerCase()
      );
    if (duplicate) return null;
  } else {
    if (
      current.type === "directory" &&
      desiredType === "file" &&
      current.children &&
      current.children.length > 0
    ) {
      return null;
    }
  }

  if (desiredName === current.name && desiredType === current.type) {
    return null;
  }

  const nextNode: FileNode = {
    ...current,
    name: desiredName,
    type: desiredType,
  };

  const nodes = { ...template.nodes, [nodeId]: nextNode };
  const updatedNodes = propagatePaths(nodes, nodeId);
  const updatedTemplate: HierarchyTemplate = {
    ...template,
    nodes: updatedNodes,
  };

  return isRootNode ? ensureRootInvariant(updatedTemplate) : updatedTemplate;
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

export function removeRootNode(
  template: HierarchyTemplate,
  rootId: string
): HierarchyTemplate | null {
  if (!isRoot(template, rootId)) return null;
  if (template.rootNodes.length <= 1) {
    return null;
  }
  const toDelete = collectDescendants(template, rootId);
  const nodes: Record<string, FileNode> = {};
  for (const [id, node] of Object.entries(template.nodes)) {
    if (!toDelete.has(id)) {
      nodes[id] = node;
    }
  }
  const rootNodes = template.rootNodes.filter((id) => id !== rootId);
  const cleaned: HierarchyTemplate = {
    ...template,
    nodes,
    rootNodes,
  };
  return ensureRootInvariant(cleaned);
}

export function extractTemplateForRoot(
  template: HierarchyTemplate,
  rootId: string
): HierarchyTemplate | null {
  const root = template.nodes[rootId];
  if (!root) return null;
  const nodes: Record<string, FileNode> = {};
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const source = template.nodes[id];
    if (!source) continue;
    nodes[id] = {
      ...source,
      children: [...source.children],
    };
    stack.push(...source.children);
  }
  return {
    ...template,
    nodes,
    rootNodes: [rootId],
  };
}

export function appendTemplateRoot(
  template: HierarchyTemplate,
  rootTemplate: HierarchyTemplate
): { template: HierarchyTemplate; rootId: string } {
  const sourceRootId = rootTemplate.rootNodes[0];
  const sourceRoot = rootTemplate.nodes[sourceRootId];
  if (!sourceRoot) {
    return { template, rootId: "" };
  }

  let working = template;
  const { template: withRoot, rootId } = addRootNode(
    working,
    sourceRoot.name || "Nouvelle racine"
  );
  working = withRoot;

  const queue: Array<{ sourceId: string; targetId: string }> = [
    { sourceId: sourceRootId, targetId: rootId },
  ];

  while (queue.length) {
    const { sourceId, targetId } = queue.shift()!;
    const sourceNode = rootTemplate.nodes[sourceId];
    if (!sourceNode) continue;
    for (const childId of sourceNode.children) {
      const child = rootTemplate.nodes[childId];
      if (!child) continue;
      const beforeIds = new Set(Object.keys(working.nodes));
      working = createNode(working, child.name, child.type, {
        parentId: targetId,
      });
      const newId = Object.keys(working.nodes).find((id) => !beforeIds.has(id));
      if (!newId) continue;
      queue.push({ sourceId: childId, targetId: newId });
    }
  }

  return { template: working, rootId };
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
  const build = (id: string): YamlNode | null => {
    const n = template.nodes[id];
    if (!n) return null;
    if (n.type === "file") {
      return { name: n.name, type: "file" };
    }
    const children = (n.children || [])
      .map((childId) => build(childId))
      .filter((c): c is YamlNode => !!c);
    const node: YamlNode = { name: n.name, type: "directory" };
    if (children.length) node.children = children;
    return node;
  };

  const roots = template.rootNodes
    .map((id) => build(id))
    .filter((root): root is YamlNode => root !== null);

  if (!roots.length) {
    return { root: { name: "Racine", type: "directory" } };
  }
  if (roots.length === 1) {
    return { root: roots[0] };
  }
  return { roots };
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
  const yamlRoots: YamlNode[] = [];
  if (Array.isArray(yamlStruct.roots) && yamlStruct.roots.length) {
    yamlRoots.push(...yamlStruct.roots.filter(Boolean));
  } else if (yamlStruct.root) {
    yamlRoots.push(yamlStruct.root);
  }

  if (!yamlRoots.length) {
    return createDefaultTemplate();
  }

  const nodes: Record<string, FileNode> = {};
  const rootIds: string[] = [];
  const usedRootNames = new Set<string>();

  const addNode = (
    yNode: YamlNode,
    parentId: string | null,
    parentPath: string,
    forcedName?: string
  ): string => {
    const rawName = forcedName ?? yNode.name ?? "";
    const safeName = rawName.trim() || "Nœud";
    const id = parentId ? generateNodeId() : generateNodeId();
    const type: FileNode["type"] = parentId ? yNode.type : "directory";
    const resolvedType = type === "directory" ? "directory" : "file";
    const path = parentId ? `${parentPath}/${safeName}` : safeName;
    const node: FileNode = {
      id,
      name: safeName,
      type: resolvedType,
      path,
      parent: parentId || undefined,
      children: [],
    };
    nodes[id] = node;

    if (
      resolvedType === "directory" &&
      Array.isArray(yNode.children) &&
      yNode.children.length
    ) {
      for (const child of yNode.children) {
        if (!child || typeof child.name !== "string" || !child.type) continue;
        const childId = addNode(child, id, path);
        nodes[id] = {
          ...nodes[id],
          children: [...nodes[id].children, childId],
        };
      }
    }

    return id;
  };

  yamlRoots.forEach((rootYaml, index) => {
    const rawName = rootYaml.name ?? `Racine ${index + 1}`;
    let finalName = rawName.trim() || `Racine ${index + 1}`;
    let suffix = 2;
    while (usedRootNames.has(finalName.toLowerCase())) {
      finalName = `${rawName.trim() || "Racine"} (${suffix})`;
      suffix++;
    }
    usedRootNames.add(finalName.toLowerCase());
    const rootId = addNode(rootYaml, null, "", finalName);
    nodes[rootId] = {
      ...nodes[rootId],
      parent: undefined,
      type: "directory",
      path: finalName,
    };
    rootIds.push(rootId);
  });

  return ensureRootInvariant({
    id: "imported",
    name: "Modèle importé",
    description: "Importé depuis YAML",
    nodes,
    rootNodes: rootIds,
  });
}
