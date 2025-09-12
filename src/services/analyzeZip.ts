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

  // Préfixe pratique pour filtrer les éléments sous le dossier racine des étudiants.
  const studentDirPrefix = studentRootPath ? studentRootPath + "/" : "";

  // Collecter tous les chemins de fichiers et dossiers dans le zip.
  interface ZipEntryMeta {
    path: string; // chemin normalisé sans slash final
    isDir: boolean;
    entry?: JSZip.JSZipObject; // référence brute pour fichiers (utile pour ZIP imbriqué)
  }
  const entries: ZipEntryMeta[] = [];
  zip.forEach((relativePath, entry) => {
    const clean = relativePath.replace(/\\/g, "/");
    if (!clean) return;
    const isDir = entry.dir;
    const normalized = clean.endsWith("/") ? clean.slice(0, -1) : clean;
    entries.push({ path: normalized, isDir, entry });
  });

  // Indexation rapide par dossier parent => enfants dirs
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
      // Créer chaînes de dossiers pour son parent (sinon parent isolé absent)
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

  // Exploration des ZIP imbriqués : on traite tout fichier *.zip sous le chemin racine étudiant.
  const includeNestedZips = true; // activable/désactivable si besoin UI plus tard
  async function expandNestedZips() {
    if (!includeNestedZips) return;
    const queue: { entry: JSZip.JSZipObject; virtualRoot: string }[] = [];
    for (const e of entries) {
      if (!e.isDir && /\.zip$/i.test(e.path)) {
        // Limiter à la zone étudiante si précise
        if (studentRootPath && !e.path.startsWith(studentDirPrefix)) continue;
        const baseName = e.path.split("/").pop() || e.path;
        const withoutExt = baseName.replace(/\.zip$/i, "");
        const parent = e.path.includes("/")
          ? e.path.slice(0, e.path.lastIndexOf("/"))
          : "";
        const virtualRoot = parent ? parent + "/" + withoutExt : withoutExt;
        queue.push({ entry: e.entry!, virtualRoot });
      }
    }

    while (queue.length) {
      const { entry, virtualRoot } = queue.shift()!;
      try {
        const buf = await entry.async("arraybuffer");
        const nested = await JSZip.loadAsync(buf);
        // S'assurer que la racine virtuelle existe
        ensureDir(virtualRoot);
        nested.forEach((rel, nestedEntry) => {
          const clean = rel.replace(/\\/g, "/");
          if (!clean) return;
          const normalized = clean.endsWith("/") ? clean.slice(0, -1) : clean;
          if (!normalized) return; // évite ajouter racine vide
          const fullPath = virtualRoot + "/" + normalized;
          const isDir = nestedEntry.dir;
          if (isDir) {
            ensureDir(fullPath);
          } else {
            fileSet.add(fullPath);
            // Créer hiérarchie de dossiers
            if (fullPath.includes("/")) {
              const parts = fullPath.split("/");
              for (let i = 0; i < parts.length - 1; i++) {
                const d = parts.slice(0, i + 1).join("/");
                ensureDir(d);
              }
            }
            if (/\.zip$/i.test(fullPath)) {
              // ZIP imbriqué de niveau supplémentaire
              const baseName2 = fullPath.split("/").pop() || fullPath;
              const withoutExt2 = baseName2.replace(/\.zip$/i, "");
              const parent2 = fullPath.includes("/")
                ? fullPath.slice(0, fullPath.lastIndexOf("/"))
                : "";
              const virtualRoot2 = parent2
                ? parent2 + "/" + withoutExt2
                : withoutExt2;
              queue.push({ entry: nestedEntry, virtualRoot: virtualRoot2 });
            }
          }
        });
      } catch {
        // On ignore silencieusement un ZIP corrompu interne pour ne pas bloquer l'analyse.
        // console.warn("Impossible de lire un ZIP imbriqué", err);
      }
    }
  }

  await expandNestedZips();

  // Obtenir la liste des dossiers étudiants (enfants directs de studentRootPath)
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
    name: string; // nom tel que dans le modèle (peut contenir wildcards)
    type: "file" | "directory";
    nameRegex?: RegExp; // regex compilée si wildcard présent
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
    let nameRegex: RegExp | undefined;
    if (/[*?]/.test(n.name)) {
      // Transformer wildcard simple en regex ^...$
      const pattern = n.name
        .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&") // échapper regex spéciaux
        .replace(/\\\*/g, ".*")
        .replace(/\\\?/g, ".");
      try {
        nameRegex = new RegExp(`^${pattern}$`, "i");
      } catch {
        nameRegex = undefined; // ignorer si échec
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
      const expectedDir = relative
        ? candidatePath + "/" + relative
        : candidatePath;
      let status: MatchResult["status"] = "missing";
      let score = 0;
      let foundPath = "";
      if (tni.type === "directory") {
        // Pour un dossier avec wildcard sur le dernier segment, tenter correspondance parmi enfants du parent
        const parentPath = expectedDir.includes("/")
          ? expectedDir.slice(0, expectedDir.lastIndexOf("/"))
          : "";
        const segName = tni.pathSegments[tni.pathSegments.length - 1];
        if (tni.nameRegex) {
          const siblings = dirChildren[parentPath] || new Set();
          for (const d of siblings) {
            if (d.endsWith("/" + segName)) {
              // ce cas est déjà exact; mais si wildcard, on veut matcher pattern sur le dernier segment réel
            }
          }
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
        const expectedFile = expectedDir; // même variable
        if (tni.nameRegex) {
          // Chercher n'importe quel fichier dans le parent correspondant au pattern
          const parentPath = expectedFile.includes("/")
            ? expectedFile.slice(0, expectedFile.lastIndexOf("/"))
            : "";
          const parentPrefix = parentPath ? parentPath + "/" : "";
          // parcourir fileSet pour ce parent (optimisable à l'avenir)
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
    let picked = Array.from(candidateProjects.values()).sort(
      (a, b) => b.score - a.score
    );
    // Filtrer doublons parent/enfant: garder le plus profond OU meilleur score.
    // Stratégie: itérer du meilleur score au moins bon, garder si aucun projet déjà retenu n'est ancêtre ou descendant.
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
        // Conflit ancêtre/descendant -> on garde celui déjà présent (car meilleur score) et on ignore ce pj
        continue;
      }
      filtered.push(pj);
      if (filtered.length >= projectsPerStudent) break;
    }
    picked = filtered;
    const overall = picked.length ? picked[0].score : 0;
    // Pour rétrocompatibilité, on peuple matches avec le premier projet (sinon vide)
    const legacyMatches = picked.length ? picked[0].templateMatches : [];
    results.push({
      name: studentDir.slice(studentDirPrefix.length),
      overallScore: overall,
      matches: legacyMatches,
      projects: picked,
      expectedProjects: projectsPerStudent,
    });
  }

  // Stratégie de nommage améliorée :
  // 1. Calcul du préfixe commun et du suffixe commun entre tous les chemins relatifs d'un étudiant.
  // 2. Le nom détaillé = segments entre ces deux zones (zone « variable »). Exemple :
  //    A/B/C1/X et A/B/C2/X  => prefix commun [A,B], suffixe commun [X] => variable = [C1] / [C2].
  // 3. Si la zone variable est vide (chemins quasi identiques), on prend le dernier segment du chemin.
  // 4. Si collisions persistent, on élargit en ajoutant des segments autour (en remontant côté préfixe puis côté suffixe)
  //    jusqu'à unicité ou épuisement, sinon suffixe numérique.
  // Utilitaire de normalisation (accents -> ASCII, non alphanum -> _ , trim / collapse _ )
  function slugify(input: string): string {
    const ascii = input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // diacritiques
      .replace(/[^A-Za-z0-9]+/g, "_") // blocs non alphanum
      .replace(/_+/g, "_") // underscores multiples
      .replace(/^_+|_+$/g, "") // trim
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
