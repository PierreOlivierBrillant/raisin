import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { StudentFolder, StudentProject } from "../types";

/**
 * Génère une archive standardisée où chaque projet détecté est recopié
 * sous son nouveau chemin (newPath). Les archives .zip internes sont
 * traitées comme des dossiers (le nom de fichier sans extension) et
 * entièrement développées récursivement.
 */
export async function generateStandardizedZip(
  originalZipFile: File,
  results: StudentFolder[],
  options: { outputName?: string } = {},
  onProgress?: (ratio: number, currentPath?: string) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  const arrayBuffer = await originalZipFile.arrayBuffer();
  const rootZip = await JSZip.loadAsync(arrayBuffer);
  const outZip = new JSZip();

  interface VirtualFileRef {
    path: string; // chemin virtuel (sans trailing slash)
    file: JSZip.JSZipObject; // contenu réel
  }

  const virtualFiles: VirtualFileRef[] = [];
  const virtualFilesByPath = new Map<string, VirtualFileRef>();

  async function expand(zip: JSZip, prefix: string) {
    const tasks: Promise<void>[] = [];
    zip.forEach((rel, entry) => {
      tasks.push(
        (async () => {
          const clean = rel.replace(/\\/g, "/");
          if (!clean) return;
          if (entry.dir) return; // dossiers implicites
          const normalized = clean.endsWith("/") ? clean.slice(0, -1) : clean;
          if (/\.zip$/i.test(normalized)) {
            // Déplier un zip interne comme dossier noExt
            const base = normalized.split("/").pop() || normalized;
            const noExt = base.replace(/\.zip$/i, "");
            const parentPath = normalized.includes("/")
              ? normalized.slice(0, normalized.lastIndexOf("/"))
              : "";
            const virtualRoot = parentPath
              ? [prefix, parentPath].filter(Boolean).join("/") + "/" + noExt
              : [prefix, noExt].filter(Boolean).join("/");
            const buf = await entry.async("arraybuffer");
            const nested = await JSZip.loadAsync(buf);
            await expand(nested, virtualRoot);
          } else {
            const virtualPath = [prefix, normalized].filter(Boolean).join("/");
            const ref: VirtualFileRef = { path: virtualPath, file: entry };
            virtualFiles.push(ref);
            virtualFilesByPath.set(virtualPath, ref);
          }
        })()
      );
    });
    await Promise.all(tasks);
  }

  const normalizeZipSegments = (path: string) =>
    path
      .split("/")
      .map((segment) => segment.replace(/\.zip$/i, ""))
      .join("/");

  const normalizePath = (raw?: string | null): string | undefined => {
    if (raw == null) return undefined;
    if (raw === "") return "";
    return raw.replace(/\/+$/g, "");
  };

  const parentDir = (path: string): string => {
    if (!path) return "";
    const idx = path.lastIndexOf("/");
    return idx >= 0 ? path.slice(0, idx) : "";
  };

  const computeLca = (paths: string[]): string => {
    if (!paths.length) return "";
    const segmentsList = paths.map((p) => (p ? p.split("/") : []));
    let index = 0;
    while (true) {
      const segment = segmentsList[0][index];
      if (segment === undefined) break;
      if (segmentsList.some((arr) => arr[index] !== segment)) break;
      index++;
    }
    if (!index) return "";
    return segmentsList[0].slice(0, index).join("/");
  };

  const deriveEffectiveRoot = (
    project: StudentProject,
    baseRoot: string
  ): string => {
    const normalizedBase = normalizePath(baseRoot) ?? "";
    const matches = project.templateMatches ?? [];
    const candidateDirs: string[] = [];

    for (const match of matches) {
      if (!match.foundPath) continue;
      const normalizedMatch = normalizePath(match.foundPath);
      if (normalizedMatch === undefined) continue;
      if (
        normalizedBase &&
        !normalizedMatch.startsWith(normalizedBase) &&
        !normalizedBase.startsWith(normalizedMatch)
      ) {
        continue;
      }
      if (normalizedMatch && virtualFilesByPath.has(normalizedMatch)) {
        const parent = parentDir(normalizedMatch);
        candidateDirs.push(parent);
      } else if (normalizedMatch) {
        candidateDirs.push(normalizedMatch);
      }
    }

    if (!candidateDirs.length) return normalizedBase;
    const filtered = candidateDirs.filter((p) =>
      normalizedBase
        ? p.startsWith(normalizedBase) || normalizedBase.startsWith(p)
        : true
    );
    const source = filtered.length ? filtered : candidateDirs;
    const lca = computeLca(source);
    if (!lca) return normalizedBase;
    if (normalizedBase && !lca.startsWith(normalizedBase)) {
      if (normalizedBase.startsWith(lca)) return lca;
      return normalizedBase;
    }
    return lca;
  };

  const buildCandidateRoots = (
    primary?: string,
    secondary?: string,
    extras: string[] = []
  ) => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    const addCandidate = (value: string | undefined) => {
      if (value === undefined) return;
      if (seen.has(value)) return;
      seen.add(value);
      ordered.push(value);
    };

    const addWithZipVariants = (raw?: string) => {
      const normalized = normalizePath(raw);
      if (normalized === undefined) return;
      addCandidate(normalized);
      if (!normalized) return;
      if (normalized.toLowerCase().includes(".zip")) {
        const segmentsVariant = normalizeZipSegments(normalized);
        if (segmentsVariant && segmentsVariant !== normalized) {
          addCandidate(segmentsVariant);
        }
        const trimmed = normalized.replace(
          /\.zip(\/|$)/gi,
          (_match, suffix) => suffix || ""
        );
        if (trimmed && trimmed !== normalized) {
          addCandidate(trimmed);
        }
      }
    };

    addWithZipVariants(primary);
    if (secondary !== primary) addWithZipVariants(secondary);
    for (const extra of extras) {
      addWithZipVariants(extra);
    }
    return ordered;
  };

  const collectRelatedCandidate = (raw: string) => {
    const target = normalizePath(raw) ?? "";
    if (!target) {
      return virtualFiles.slice();
    }
    const prefix = `${target}/`;
    return virtualFiles.filter(
      (vf) => vf.path === target || vf.path.startsWith(prefix)
    );
  };

  const projectVirtualCache = new WeakMap<
    StudentProject,
    { related: VirtualFileRef[]; effectiveRoot: string }
  >();

  const ensureProjectFiles = (project: StudentProject) => {
    const cached = projectVirtualCache.get(project);
    if (cached) return cached;
    const baseRoot = normalizePath(project.projectRootPath) ?? "";
    const matchParents = new Set<string>();
    for (const match of project.templateMatches ?? []) {
      if (!match.foundPath) continue;
      const normalizedMatch = normalizePath(match.foundPath);
      if (normalizedMatch === undefined) continue;
      matchParents.add(parentDir(normalizedMatch));
    }
    const resolvedRoot = deriveEffectiveRoot(project, baseRoot);
    const candidates = buildCandidateRoots(
      resolvedRoot,
      baseRoot,
      Array.from(matchParents)
    );
    let related: VirtualFileRef[] = [];
    let matchedRoot: string | undefined;
    for (const candidate of candidates) {
      related = collectRelatedCandidate(candidate);
      if (related.length) {
        matchedRoot = candidate;
        break;
      }
    }
    if (!related.length && baseRoot && !candidates.includes(baseRoot)) {
      const fallbackRelated = collectRelatedCandidate(baseRoot);
      if (fallbackRelated.length) {
        related = fallbackRelated;
        matchedRoot = baseRoot;
      }
    }
    if (related.length === 1) {
      const sole = related[0];
      const parent = parentDir(sole.path);
      if (parent) {
        const siblings = collectRelatedCandidate(parent);
        if (siblings.length > related.length) {
          related = siblings;
          matchedRoot = parent;
        }
      }
    }
    const effectiveRoot =
      matchedRoot ?? (candidates.length ? candidates[0] : baseRoot);
    const computed = { related, effectiveRoot };
    projectVirtualCache.set(project, computed);
    return computed;
  };

  await expand(rootZip, "");

  // Pré-calcul du total de fichiers à copier pour la progression
  const projectRoots: { dstRoot: string; paths: string[] }[] = [];
  let cancelled = false;
  for (const student of results) {
    for (const project of student.projects) {
      if (isCancelled?.()) {
        cancelled = true;
        break;
      }
      const dstRoot = project.newPath.trim();
      if (!dstRoot) continue;
      const { related, effectiveRoot } = ensureProjectFiles(project);
      if (related.length === 0) continue;
      const rootPrefix = effectiveRoot ? `${effectiveRoot}/` : "";
      const filePaths: string[] = [];
      for (const vf of related) {
        const relative =
          vf.path === effectiveRoot
            ? ""
            : rootPrefix
            ? vf.path.slice(rootPrefix.length)
            : vf.path;
        filePaths.push(relative ? `${dstRoot}/${relative}` : dstRoot);
      }
      projectRoots.push({ dstRoot, paths: filePaths });
    }
  }

  const totalFiles =
    projectRoots.reduce((acc, p) => acc + p.paths.length, 0) || 1;
  let done = 0;

  // Deuxième passe : copie réelle avec progression
  if (cancelled) {
    // Rien à copier si annulation avant copie
  }
  for (const student of results) {
    for (const project of student.projects) {
      if (isCancelled?.()) {
        cancelled = true;
        break;
      }
      const dstRoot = project.newPath.trim();
      if (!dstRoot) continue;
      const { related, effectiveRoot } = ensureProjectFiles(project);
      if (related.length === 0) continue;
      const rootPrefix = effectiveRoot ? `${effectiveRoot}/` : "";
      for (const vf of related) {
        if (isCancelled?.()) {
          cancelled = true;
          break;
        }
        const relative =
          vf.path === effectiveRoot
            ? ""
            : rootPrefix
            ? vf.path.slice(rootPrefix.length)
            : vf.path;
        const dest = relative ? `${dstRoot}/${relative}` : dstRoot;
        const content = await vf.file.async("arraybuffer");
        outZip.file(dest, content);
        done++;
        if (onProgress && done % 5 === 0) {
          onProgress(done / totalFiles, dest);
        }
      }
      if (cancelled) break;
      if (onProgress) onProgress(done / totalFiles, undefined);
    }
    if (cancelled) break;
  }
  if (cancelled) {
    class CancelledError extends Error {
      cancelled = true;
      constructor() {
        super("CANCELLED");
      }
    }
    throw new CancelledError();
  }
  if (onProgress) onProgress(1, undefined);

  const blob = await outZip.generateAsync({ type: "blob" });
  if (typeof window !== "undefined") {
    saveAs(blob, options.outputName || "standardized.zip");
  }
  return blob;
}
