import JSZip from "jszip";
import type {
  HierarchyTemplate,
  StudentFolder,
  StudentProject,
  MatchResult,
} from "../types";

export interface AnalysisParams {
  template: HierarchyTemplate; // modèle de référence
  zipFile: File; // archive fournie par l'utilisateur
  studentRootPath: string; // chemin (dans le zip) du dossier contenant les dossiers étudiants ("" si racine)
  projectsPerStudent: number; // limite de projets à détecter
}

/**
 * Analyse le ZIP pour détecter, pour chaque dossier étudiant (enfants directs de studentRootPath),
 * jusqu'à N projets dont la structure correspond au modèle à >= 90%.
 * La détection d'un projet consiste à chercher un sous-dossier dont au moins 90% des nœuds du modèle
 * (hors racine) peuvent être retrouvés en conservant l'organisation (présence des répertoires/fichiers attendus).
 * La similarité est calculée: (nœuds trouvés / total nœuds modèle non-racine)*100.
 */
export async function analyzeZipStructureMock(
  params: AnalysisParams
): Promise<StudentFolder[]> {
  const { template, zipFile, studentRootPath, projectsPerStudent } = params;
  const data = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(data);

  // Collecter tous les chemins de fichiers et dossiers dans le zip.
  interface ZipEntryMeta {
    path: string; // sans slash initial
    isDir: boolean;
  }
  const entries: ZipEntryMeta[] = [];
  zip.forEach((relativePath, entry) => {
    const clean = relativePath.replace(/\\/g, "/");
    if (!clean) return;
    const isDir = entry.dir;
    const normalized = clean.endsWith("/") ? clean.slice(0, -1) : clean;
    entries.push({ path: normalized, isDir });
  });

  // Indexation rapide par dossier parent => enfants dirs
  const dirChildren: Record<string, Set<string>> = {};
  const fileSet = new Set<string>();
  for (const e of entries) {
    const parent = e.path.includes("/")
      ? e.path.slice(0, e.path.lastIndexOf("/"))
      : "";
    if (e.isDir) {
      if (!dirChildren[parent]) dirChildren[parent] = new Set();
      dirChildren[parent].add(e.path);
      if (!dirChildren[e.path]) dirChildren[e.path] = new Set();
    } else {
      fileSet.add(e.path);
    }
  }

  // Obtenir la liste des dossiers étudiants (enfants directs de studentRootPath)
  const studentDirPrefix = studentRootPath ? studentRootPath + "/" : "";
  const studentDirs = Array.from(dirChildren[studentRootPath || ""] || [])
    .filter((d) => d.startsWith(studentDirPrefix))
    .map((d) => d); // déjà chemins relatifs

  // Préparer la liste plate des nœuds modèle (hors racine) avec structure relative
  const rootId = template.rootNodes[0];
  const rootNode = template.nodes[rootId];
  if (!rootNode) return [];

  interface TemplateNodeInfo {
    id: string;
    pathSegments: string[]; // segments relatifs sous racine modèle
    name: string;
    type: "file" | "directory";
  }
  const templateNodeInfos: TemplateNodeInfo[] = [];
  const stack = [...rootNode.children];
  while (stack.length) {
    const id = stack.pop()!;
    const n = template.nodes[id];
    if (!n) continue;
    // path dans le modèle commence par 'Racine/...' => retirer le premier segment
    const fullSegs = n.path.split("/");
    const segs = fullSegs.slice(1); // enlever 'Racine'
    templateNodeInfos.push({
      id: n.id,
      pathSegments: segs,
      name: n.name,
      type: n.type,
    });
    if (n.type === "directory") stack.push(...n.children);
  }
  const totalTemplateNodes = templateNodeInfos.length || 1; // éviter division par 0

  function evaluateProjectCandidate(
    studentRoot: string,
    candidatePath: string
  ): StudentProject | null {
    // candidatePath est un dossier sous le dossier de l'étudiant (ou plus profond) considéré comme racine projet.
    // On reconstitue pour chaque nœud modèle le chemin attendu relatif à candidatePath.
    let matched = 0;
    const matchResults: MatchResult[] = [];
    for (const tni of templateNodeInfos) {
      const relative = tni.pathSegments.join("/");
      const expectedFull = relative
        ? candidatePath + "/" + relative
        : candidatePath;
      let status: MatchResult["status"] = "missing";
      let score = 0;
      if (tni.type === "directory") {
        // Un répertoire est considéré trouvé s'il existe dans dirChildren
        if (dirChildren[expectedFull]) {
          status = "found";
          score = 100;
          matched++;
        }
      } else {
        if (fileSet.has(expectedFull)) {
          status = "found";
          score = 100;
          matched++;
        }
      }
      matchResults.push({
        templateNodeId: tni.id,
        foundPath: status === "found" ? expectedFull : "",
        score,
        status,
      });
    }
    const similarity = Math.round((matched / totalTemplateNodes) * 100);
    if (similarity < 90) return null; // seuil de 90%
    // Le nom du dossier de l'étudiant est le premier segment après studentRootPath
    const studentName = studentRoot
      .slice(studentDirPrefix.length)
      .split("/")[0];
    const projectLeaf = candidatePath.split("/").slice(-1)[0];
    const suggested = `${studentName}_${projectLeaf}`;
    return {
      projectRootPath: candidatePath,
      score: similarity,
      matchedNodesCount: matched,
      totalTemplateNodes,
      templateMatches: matchResults,
      suggestedNewPath: suggested,
      newPath: suggested,
    };
  }

  const results: StudentFolder[] = [];
  for (const studentDir of studentDirs) {
    // Les sous-dossiers potentiels de projets sont tous les dossiers descendants de studentDir.
    const candidateProjects = new Map<string, StudentProject>();
    // Collecter récursivement dossiers sous studentDir
    const stackDirs = [studentDir];
    const visited = new Set<string>();
    while (stackDirs.length) {
      const current = stackDirs.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const children = dirChildren[current];
      if (children) {
        for (const child of children) stackDirs.push(child);
      }
      if (current !== studentDir) {
        const pj = evaluateProjectCandidate(studentDir, current);
        if (pj) candidateProjects.set(current, pj);
      }
    }
    // Trier par score desc puis prendre jusqu'à projectsPerStudent
    const picked = Array.from(candidateProjects.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, projectsPerStudent);
    const overall = picked.length ? picked[0].score : 0;
    // Pour rétrocompatibilité, on peuple matches avec le premier projet (sinon vide)
    const legacyMatches = picked.length ? picked[0].templateMatches : [];
    results.push({
      name: studentDir.slice(studentDirPrefix.length),
      overallScore: overall,
      matches: legacyMatches,
      projects: picked,
    });
  }

  // Tri résultat par nom étudiant
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}
