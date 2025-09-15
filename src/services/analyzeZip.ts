import JSZip from "jszip";
import type {
  HierarchyTemplate,
  StudentFolder,
  StudentProject,
  MatchResult,
} from "../types";
import type { IZipReader } from "../types/zip";

export interface AnalysisParams {
  template: HierarchyTemplate; // modèle de référence
  zipFile: File; // archive fournie par l'utilisateur (WEB ONLY)
  studentRootPath: string; // chemin (dans le zip) du dossier contenant les dossiers étudiants ("" si racine)
  projectsPerStudent: number; // limite de projets à détecter
  similarityThreshold?: number; // pourcentage minimal (0-100) requis (défaut 90)
}

export interface ReaderAnalysisParams {
  template: HierarchyTemplate;
  reader: IZipReader; // abstraction (web ou desktop)
  studentRootPath: string;
  projectsPerStudent: number;
  similarityThreshold?: number;
  includeNestedZips?: boolean; // Desktop pourra déléguer côté Rust, sinon fallback client
}

/**
 * Nouvelle version utilisant un IZipReader afin de ne pas forcer le chargement total du zip.
 */
export async function analyzeZipWithReader(
  params: ReaderAnalysisParams
): Promise<StudentFolder[]> {
  const { template, reader, studentRootPath, projectsPerStudent } = params;
  const similarityThreshold = Math.min(
    100,
    Math.max(0, params.similarityThreshold ?? 90)
  );
  const includeNestedZips = params.includeNestedZips ?? true;

  // listEntries doit être léger; sur Desktop on récupère déjà les dossiers / fichiers.
  const baseEntries = await reader.listEntries();

  interface ZipEntryMeta {
    path: string;
    isDir: boolean;
  }
  const entries: ZipEntryMeta[] = baseEntries.map((e) => ({
    path: e.path.replace(/\\/g, "/").replace(/\/$/, ""),
    isDir: e.isDir,
  }));

  const studentDirPrefix = studentRootPath ? studentRootPath + "/" : "";

  const dirChildren: Record<string, Set<string>> = {};
  const fileSet = new Set<string>();

  function ensureDir(path: string) {
    const parent = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : "";
    if (!dirChildren[parent]) dirChildren[parent] = new Set();
    if (!dirChildren[parent].has(path)) dirChildren[parent].add(path);
    if (!dirChildren[path]) dirChildren[path] = new Set();
  }
  function indexInitial(e: ZipEntryMeta) {
    if (e.isDir) {
      ensureDir(e.path);
    } else {
      fileSet.add(e.path);
      if (e.path.includes("/")) {
        const parts = e.path.split("/");
        for (let i = 0; i < parts.length - 1; i++) {
          const d = parts.slice(0, i + 1).join("/");
          ensureDir(d);
        }
      }
    }
  }
  for (const e of entries) indexInitial(e);

  // NOTE: Expansion ZIP imbriqués côté abstraction => on ne développe plus ici (coût mémoire). Option: future impl.
  if (includeNestedZips && reader.capabilities?.expandNestedZipsClientSide) {
    // TODO: implémentation future si besoin côté web (reprendre logique précédente sélectivement)
  }

  const studentDirs = Array.from(dirChildren[studentRootPath || ""] || [])
    .filter((d) => d.startsWith(studentDirPrefix))
    .map((d) => d);

  const rootId = template.rootNodes[0];
  const rootNode = template.nodes[rootId];
  if (!rootNode) return [];

  interface TemplateNodeInfo {
    id: string;
    pathSegments: string[];
    name: string;
    type: "file" | "directory";
    nameRegex?: RegExp;
  }
  const templateNodeInfos: TemplateNodeInfo[] = [];
  const stack = [...rootNode.children];
  while (stack.length) {
    const id = stack.pop()!;
    const n = template.nodes[id];
    if (!n) continue;
    const fullSegs = n.path.split("/");
    const segs = fullSegs.slice(1);
    let nameRegex: RegExp | undefined;
    if (/[*?]/.test(n.name)) {
      const pattern = n.name
        .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")
        .replace(/\\\*/g, ".*")
        .replace(/\\\?/g, ".");
      try {
        nameRegex = new RegExp(`^${pattern}$`, "i");
      } catch {
        nameRegex = undefined;
      }
    }
    templateNodeInfos.push({
      id: n.id,
      pathSegments: segs,
      name: n.name,
      type: n.type,
      nameRegex,
    });
    if (n.type === "directory") stack.push(...n.children);
  }
  const totalTemplateNodes = templateNodeInfos.length || 1;

  function evaluateProjectCandidate(
    studentRoot: string,
    candidatePath: string
  ): StudentProject | null {
    let matched = 0;
    const matchResults: MatchResult[] = [];
    for (const tni of templateNodeInfos) {
      const relative = tni.pathSegments.join("/");
      const expectedDir = relative ? candidatePath + "/" + relative : candidatePath;
      let status: MatchResult["status"] = "missing";
      let score = 0;
      let foundPath = "";
      if (tni.type === "directory") {
        const parentPath = expectedDir.includes("/")
          ? expectedDir.slice(0, expectedDir.lastIndexOf("/"))
          : "";
        if (tni.nameRegex) {
          const siblings = dirChildren[parentPath] || new Set();
          for (const d of siblings) {
            const leaf = d.split("/").pop() || "";
            if (tni.nameRegex.test(leaf) && d === expectedDir) {
              status = "found";
              score = 100;
              matched++;
              foundPath = d;
              break;
            }
          }
        } else if (dirChildren[expectedDir]) {
          status = "found";
          score = 100;
          matched++;
          foundPath = expectedDir;
        }
      } else {
        const expectedFile = expectedDir;
        if (tni.nameRegex) {
          const parentPath = expectedFile.includes("/")
            ? expectedFile.slice(0, expectedFile.lastIndexOf("/"))
            : "";
          const parentPrefix = parentPath ? parentPath + "/" : "";
          for (const file of fileSet) {
            if (!file.startsWith(parentPrefix)) continue;
            const leaf = file.split("/").pop() || "";
            if (tni.nameRegex.test(leaf) && file === expectedFile) {
              status = "found";
              score = 100;
              matched++;
              foundPath = file;
              break;
            }
          }
        } else if (fileSet.has(expectedFile)) {
          status = "found";
          score = 100;
          matched++;
          foundPath = expectedFile;
        }
      }
      matchResults.push({ templateNodeId: tni.id, foundPath, score, status });
    }
    const similarity = Math.round((matched / totalTemplateNodes) * 100);
    if (similarity < similarityThreshold) return null;
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
    const candidateProjects = new Map<string, StudentProject>();
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
    let picked = Array.from(candidateProjects.values()).sort(
      (a, b) => b.score - a.score
    );
    const filtered: StudentProject[] = [];
    const isAncestor = (a: string, b: string) => b.startsWith(a + "/");
    for (const pj of picked) {
      if (
        filtered.some(
          (kept) =>
            isAncestor(kept.projectRootPath, pj.projectRootPath) ||
            isAncestor(pj.projectRootPath, kept.projectRootPath)
        )
      ) {
        continue;
      }
      filtered.push(pj);
      if (filtered.length >= projectsPerStudent) break;
    }
    picked = filtered;
    const overall = picked.length ? picked[0].score : 0;
    const legacyMatches = picked.length ? picked[0].templateMatches : [];
    results.push({
      name: studentDir.slice(studentDirPrefix.length),
      overallScore: overall,
      matches: legacyMatches,
      projects: picked,
      expectedProjects: projectsPerStudent,
    });
  }

  function slugify(input: string): string {
    const ascii = input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
    return ascii || "item";
  }

  for (const folder of results) {
    if (!folder.projects.length) continue;
    const studentNameRaw = folder.name.split("/")[0];
    const studentSlug = slugify(studentNameRaw);
    const projectInfos = folder.projects.map((project) => {
      const full = project.projectRootPath.replace(/\/$/, "");
      let rel = full.startsWith(folder.name + "/")
        ? full.slice(folder.name.length + 1)
        : full;
      rel = rel.replace(/^\/+|\/+$/g, "");
      const segments = rel ? rel.split("/").filter(Boolean) : [];
      return { project, segments };
    });
    if (projectInfos.length === 1) {
      const { project, segments } = projectInfos[0];
      const leafRaw =
        segments[segments.length - 1] ||
        project.projectRootPath.split("/").pop() ||
        "project";
      const leaf = slugify(leafRaw);
      const candidate = `${studentSlug}_${leaf}`;
      const userModified = project.newPath !== project.suggestedNewPath;
      project.suggestedNewPath = candidate;
      if (!userModified) project.newPath = candidate;
      continue;
    }
    // Préfixe commun
    let commonPrefixLen = 0;
    while (true) {
      const firstSeg = projectInfos[0].segments[commonPrefixLen];
      if (firstSeg === undefined) break;
      if (
        projectInfos.every((pi) => pi.segments[commonPrefixLen] === firstSeg)
      ) {
        commonPrefixLen++;
      } else break;
    }
    // Suffixe commun (ne pas empiéter sur le préfixe)
    let commonSuffixLen = 0;
    while (true) {
      const firstArr = projectInfos[0].segments;
      const idx = firstArr.length - 1 - commonSuffixLen;
      if (idx < commonPrefixLen) break;
      const candidateSeg = firstArr[idx];
      if (
        projectInfos.every((pi) => {
          const arr = pi.segments;
          const segIdx = arr.length - 1 - commonSuffixLen;
          return segIdx >= commonPrefixLen && arr[segIdx] === candidateSeg;
        })
      ) {
        commonSuffixLen++;
      } else break;
    }
    interface NamingState {
      project: StudentProject;
      segments: string[];
      baseIndices: number[]; // indices inclus dans le nom courant
    }
    const states: NamingState[] = projectInfos.map((pi) => {
      const start = commonPrefixLen;
      const endExclusive = pi.segments.length - commonSuffixLen;
      let variable: number[] = [];
      if (endExclusive > start) {
        for (let i = start; i < endExclusive; i++) variable.push(i);
      } else {
        // zone variable vide -> prendre dernier segment existant
        const leafIdx = pi.segments.length ? pi.segments.length - 1 : 0;
        variable = [leafIdx];
      }
      return {
        project: pi.project,
        segments: pi.segments,
        baseIndices: variable,
      };
    });
    function buildDetail(st: NamingState) {
      const parts = st.baseIndices.map((i) => st.segments[i]).filter(Boolean);
      return parts.join("-") || "project";
    }
    function computeMap() {
      return states.map((s) => buildDetail(s));
    }
    function hasDuplicates(details: string[]) {
      const seen = new Set<string>();
      for (const d of details) {
        if (seen.has(d)) return true;
        seen.add(d);
      }
      return false;
    }
    let details = computeMap();
    // Élargissement progressif tant qu'il y a des collisions
    let expandLeftStep = 1; // combien de segments de préfixe supplémentaires nous avons déjà ajoutés
    let expandRightStep = 1; // combien vers le suffixe
    while (hasDuplicates(details)) {
      const freq: Record<string, number> = {};
      details.forEach((d) => (freq[d] = (freq[d] || 0) + 1));
      const duplicateSet = new Set(
        Object.entries(freq)
          .filter(([, c]) => c > 1)
          .map(([k]) => k)
      );
      let progressed = false;
      for (const st of states) {
        const current = buildDetail(st);
        if (!duplicateSet.has(current)) continue;
        // Tenter d'ajouter un segment du côté gauche (préfixe) si disponible
        const leftIdx = commonPrefixLen - expandLeftStep;
        if (leftIdx >= 0 && !st.baseIndices.includes(leftIdx)) {
          st.baseIndices.unshift(leftIdx);
          progressed = true;
          continue;
        }
        // Sinon tenter côté droit (après la zone variable avant suffixe commun)
        const rightIdx =
          st.segments.length - commonSuffixLen + (expandRightStep - 1);
        if (
          rightIdx < st.segments.length &&
          !st.baseIndices.includes(rightIdx)
        ) {
          st.baseIndices.push(rightIdx);
          progressed = true;
          continue;
        }
      }
      if (!progressed) break;
      expandLeftStep++;
      expandRightStep++;
      details = computeMap();
      // boucle continue jusqu'à unicité ou impossibilité
    }
    // Si toujours collisions: suffixe numérique
    const finalFreq: Record<string, number> = {};
    details.forEach((d) => (finalFreq[d] = (finalFreq[d] || 0) + 1));
    const counters: Record<string, number> = {};
    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      let base = details[i];
      if (finalFreq[base] > 1) {
        const idx = (counters[base] = (counters[base] || 0) + 1);
        base = `${base}-${idx}`;
      }
      const candidate = `${studentSlug}_${slugify(base)}`;
      const userModified = st.project.newPath !== st.project.suggestedNewPath;
      st.project.suggestedNewPath = candidate;
      if (!userModified) st.project.newPath = candidate;
    }
  }

  // Mettre à jour overallScore/matches si premier projet a changé de nom (structure restée identique)
  for (const folder of results) {
    if (folder.projects[0]) {
      folder.matches = folder.projects[0].templateMatches;
      folder.overallScore = folder.projects[0].score;
    }
  }

  // Tri résultat par nom étudiant
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

/**
 * Wrapper historique web (charge entièrement en mémoire) à déprécier pour gros ZIP.
 */
export async function analyzeZipStructureMock(
  params: AnalysisParams
): Promise<StudentFolder[]> {
  const { template, zipFile, studentRootPath, projectsPerStudent } = params;
  const reader: IZipReader = {
    kind: 'jszip',
    listEntries: async () => {
      const data = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const out: { path: string; isDir: boolean }[] = [];
      zip.forEach((relativePath, entry) => {
        const clean = relativePath.replace(/\\/g, "/");
        if (!clean) return;
        const normalized = clean.endsWith("/") ? clean.slice(0, -1) : clean;
        out.push({ path: normalized, isDir: entry.dir });
      });
      return out;
    },
    capabilities: { expandNestedZipsClientSide: true }
  };
  return analyzeZipWithReader({
    template,
    reader,
    studentRootPath,
    projectsPerStudent,
    similarityThreshold: params.similarityThreshold,
  });
}
