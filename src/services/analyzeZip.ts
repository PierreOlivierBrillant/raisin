import type {
  HierarchyTemplate,
  StudentFolder,
  StudentProject,
  MatchResult,
} from "../types";
import type { IZipReader } from "../types/zip";
import { collectEntriesFromJSZip } from "./zipEntryUtils";
import type { ZipSource } from "../types/zip";

export interface AnalysisParams {
  template: HierarchyTemplate; // modèle de référence
  zipFile: File; // archive fournie par l'utilisateur (WEB ONLY)
  studentRootPath: string; // chemin (dans le zip) du dossier contenant les dossiers étudiants ("" si racine)
  projectsPerStudent: number; // limite de projets à détecter
  similarityThreshold?: number; // pourcentage minimal (0-100) requis (défaut 90)
}

export interface ZipStructureAnalysisParams {
  template: HierarchyTemplate;
  zipSource: ZipSource;
  studentRootPath: string;
  projectsPerStudent: number;
  similarityThreshold?: number;
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

  const baseEntries = await reader.listEntries();

  interface ZipEntryMeta {
    path: string;
    isDir: boolean;
  }

  const entries: ZipEntryMeta[] = baseEntries
    .map((entry) => ({
      path: entry.path.replace(/\\/g, "/").replace(/\/$/, ""),
      isDir: entry.isDir,
    }))
    .filter((entry) => entry.path !== "");

  let effectiveRoot = studentRootPath.replace(/^\/+|\/+$/g, "");
  if (effectiveRoot === ".") effectiveRoot = "";
  if (
    effectiveRoot &&
    !entries.some(
      (e) => e.path === effectiveRoot || e.path.startsWith(`${effectiveRoot}/`)
    )
  ) {
    effectiveRoot = "";
  }
  const studentDirPrefix = effectiveRoot ? `${effectiveRoot}/` : "";

  const dirChildren: Record<string, Set<string>> = {};
  const filesByDir: Record<string, Set<string>> = {};
  const fileSet = new Set<string>();

  function ensureDir(path: string) {
    if (!dirChildren[path]) dirChildren[path] = new Set();
    if (path === "") return;
    const parent = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : "";
    if (!dirChildren[parent]) dirChildren[parent] = new Set();
    dirChildren[parent].add(path);
  }

  function registerFile(path: string) {
    fileSet.add(path);
    const parts = path.split("/");
    let current = "";
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      ensureDir(current);
    }
    const parent = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    if (!filesByDir[parent]) filesByDir[parent] = new Set();
    filesByDir[parent].add(path);
  }

  for (const entry of entries) {
    if (entry.isDir) {
      ensureDir(entry.path);
    } else {
      registerFile(entry.path);
    }
  }

  if (!dirChildren[effectiveRoot || ""]) {
    dirChildren[effectiveRoot || ""] = new Set();
  }

  if (includeNestedZips && reader.capabilities?.expandNestedZipsClientSide) {
    // Prévu pour implémentation future côté web si nécessaire.
  }

  const topLevelCandidates = new Set<string>(
    Array.from(dirChildren[effectiveRoot || ""] || [])
  );
  for (const filePath of fileSet) {
    if (!filePath.startsWith(studentDirPrefix)) continue;
    const relative = filePath.slice(studentDirPrefix.length);
    if (!relative.includes("/")) continue; // ignorer les fichiers au niveau racine
    const segment = relative.split("/")[0];
    if (!segment) continue;
    const inferred = effectiveRoot ? `${effectiveRoot}/${segment}` : segment;
    topLevelCandidates.add(inferred);
  }

  const rootId = template.rootNodes[0];
  const rootNode = template.nodes[rootId];
  if (!rootNode) return [];

  interface TemplateNodeInfo {
    id: string;
    pathSegments: string[];
    type: "file" | "directory";
    segmentMatchers: RegExp[];
  }

  const makeSegmentRegex = (segment: string) => {
    const escaped = segment.replace(/([.+^${}()|[\]\\])/g, "\\$1");
    const pattern = escaped.replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
    return new RegExp(`^${pattern}$`, "i");
  };

  const templateNodeInfos: TemplateNodeInfo[] = [];
  const stack = [...rootNode.children];
  while (stack.length) {
    const id = stack.pop()!;
    const node = template.nodes[id];
    if (!node) continue;
    const segments = node.path.split("/").slice(1);
    templateNodeInfos.push({
      id: node.id,
      pathSegments: segments,
      type: node.type,
      segmentMatchers: segments.map((seg) => makeSegmentRegex(seg)),
    });
    if (node.type === "directory") stack.push(...node.children);
  }

  const literalRootSegments = new Set<string>();
  for (const info of templateNodeInfos) {
    if (!info.pathSegments.length) continue;
    const firstSegment = info.pathSegments[0];
    if (!firstSegment) continue;
    if (firstSegment.includes("*") || firstSegment.includes("?")) continue;
    literalRootSegments.add(firstSegment.toLowerCase());
  }

  const studentDirSet = new Set<string>();
  for (const candidate of topLevelCandidates) {
    if (!candidate.startsWith(studentDirPrefix)) continue;
    const relative = studentDirPrefix
      ? candidate.slice(studentDirPrefix.length)
      : candidate;
    const firstSegment = relative.split("/")[0]?.toLowerCase() ?? "";
    if (firstSegment && literalRootSegments.has(firstSegment)) continue;
    studentDirSet.add(candidate);
  }
  const rootCandidate = effectiveRoot || "";
  if (
    studentDirSet.size === 0 ||
    (effectiveRoot && !studentDirSet.has(rootCandidate))
  ) {
    studentDirSet.add(rootCandidate);
  }
  const studentDirs = Array.from(studentDirSet);

  const totalTemplateNodes = templateNodeInfos.length || 1;

  function matchDirectorySegments(
    basePath: string,
    matchers: RegExp[]
  ): string[] {
    let current = [basePath || ""];
    for (const matcher of matchers) {
      const next: string[] = [];
      for (const prefix of current) {
        const children = dirChildren[prefix] || new Set<string>();
        for (const child of children) {
          const leaf = child.split("/").pop() || "";
          if (matcher.test(leaf)) next.push(child);
        }
      }
      if (!next.length) return [];
      current = next;
    }
    return current;
  }

  function evaluateProjectCandidate(
    studentRoot: string,
    candidatePath: string
  ): StudentProject | null {
    let cumulativeScore = 0;
    const matchResults: MatchResult[] = [];

    for (const info of templateNodeInfos) {
      let status: MatchResult["status"] = "missing";
      let score = 0;
      let foundPath = "";

      if (info.type === "directory") {
        const matches = matchDirectorySegments(
          candidatePath,
          info.segmentMatchers
        );
        if (matches.length) {
          status = "found";
          score = 100;
          foundPath = matches[0];
        }
      } else {
        const segments = info.segmentMatchers;
        if (segments.length) {
          const dirMatchers = segments.slice(0, -1);
          const fileMatcher = segments[segments.length - 1];
          const parentCandidates = dirMatchers.length
            ? matchDirectorySegments(candidatePath, dirMatchers)
            : [candidatePath || ""];
          for (const parentPath of parentCandidates) {
            const files = filesByDir[parentPath] || new Set<string>();
            for (const file of files) {
              const leaf = file.split("/").pop() || "";
              if (fileMatcher.test(leaf)) {
                status = "found";
                score = 100;
                foundPath = file;
                break;
              }
            }
            if (status === "found") break;
          }
          if (status === "missing") {
            const basePrefix = candidatePath
              ? `${candidatePath.replace(/\/+/g, "/")}/`
              : "";
            if (basePrefix) {
              for (const file of fileSet) {
                if (!file.startsWith(basePrefix)) continue;
                const relative = file.slice(basePrefix.length);
                if (!relative) continue;
                const segmentsBeforeFile = relative.split("/").length - 1;
                if (segmentsBeforeFile < dirMatchers.length) continue;
                const leaf = relative.split("/").pop() || "";
                if (fileMatcher.test(leaf)) {
                  status = "partial";
                  score = 60;
                  foundPath = file;
                  break;
                }
              }
            }
          }
        }
      }

      cumulativeScore += score;

      matchResults.push({
        templateNodeId: info.id,
        foundPath,
        score,
        status,
      });
    }

    const similarity = Math.round(cumulativeScore / totalTemplateNodes);
    const isBelowThreshold = similarity < similarityThreshold;
    if (isBelowThreshold) {
      // Optionnel : garder trace de diagnostics en développement
      // console.warn("candidate below threshold", { studentRoot, candidatePath, similarity, threshold: similarityThreshold, matchResults });
    }

    const studentName =
      studentRoot.slice(studentDirPrefix.length).split("/")[0] ||
      studentRoot ||
      "root";
    const projectLeaf = candidatePath.split("/").pop() || "project";
    const suggested = `${studentName}_${projectLeaf}`;

    return {
      projectRootPath: candidatePath,
      score: similarity,
      matchedNodesCount: matchResults.filter((m) => m.status === "found")
        .length,
      totalTemplateNodes,
      templateMatches: matchResults,
      suggestedNewPath: suggested,
      newPath: suggested,
      isBelowThreshold,
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
    const rootCandidateProject = evaluateProjectCandidate(
      studentDir,
      studentDir
    );
    if (rootCandidateProject) {
      candidateProjects.set(studentDir, rootCandidateProject);
    }
    let picked = Array.from(candidateProjects.values()).sort(
      (a, b) => b.score - a.score
    );
    const filtered: StudentProject[] = [];
    const fallback: StudentProject[] = [];
    const isAncestor = (a: string, b: string) => b.startsWith(a + "/");
    const conflictsWith = (list: StudentProject[], pj: StudentProject) =>
      list.some(
        (kept) =>
          isAncestor(kept.projectRootPath, pj.projectRootPath) ||
          isAncestor(pj.projectRootPath, kept.projectRootPath)
      );

    for (const pj of picked) {
      if (conflictsWith(filtered, pj) || conflictsWith(fallback, pj)) {
        continue;
      }
      if (!pj.isBelowThreshold && filtered.length < projectsPerStudent) {
        filtered.push(pj);
      } else if (fallback.length < projectsPerStudent) {
        fallback.push(pj);
      }
    }

    if (filtered.length < projectsPerStudent && fallback.length) {
      const remaining = projectsPerStudent - filtered.length;
      filtered.push(...fallback.slice(0, remaining));
    }

    if (!filtered.length && fallback.length) {
      filtered.push(fallback[0]);
    }

    picked = filtered.slice(0, projectsPerStudent);
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

  const hasOtherFolders = results.some((folder) => folder.name !== "");
  if (hasOtherFolders) {
    for (let i = results.length - 1; i >= 0; i--) {
      const folder = results[i];
      if (folder.name === "") {
        const topProject = folder.projects[0];
        if (topProject && topProject.score > 0) continue;
        results.splice(i, 1);
      }
    }
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
  return analyzeZipStructure({
    template: params.template,
    zipSource: { kind: "file", file: params.zipFile },
    studentRootPath: params.studentRootPath,
    projectsPerStudent: params.projectsPerStudent,
    similarityThreshold: params.similarityThreshold,
  });
}

export async function analyzeZipStructure(
  params: ZipStructureAnalysisParams
): Promise<StudentFolder[]> {
  const { template, zipSource, studentRootPath, projectsPerStudent } = params;
  if (zipSource.kind !== "file") {
    throw new Error("Seuls les fichiers ZIP sont supportés");
  }
  const reader: IZipReader = {
    kind: "jszip",
    listEntries: async () => {
      const JSZip = (await import("jszip")).default;
      const data = await zipSource.file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      return collectEntriesFromJSZip(zip);
    },
    capabilities: { expandNestedZipsClientSide: true },
  };
  return analyzeZipWithReader({
    template,
    reader,
    studentRootPath,
    projectsPerStudent,
    similarityThreshold: params.similarityThreshold,
  });
}
