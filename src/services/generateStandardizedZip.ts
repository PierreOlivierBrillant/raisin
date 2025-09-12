import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { StudentFolder } from "../types";

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
            virtualFiles.push({ path: virtualPath, file: entry });
          }
        })()
      );
    });
    await Promise.all(tasks);
  }

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
      const root = project.projectRootPath.replace(/\/$/, "");
      if (!root) continue;
      const dstRoot = project.newPath.trim();
      if (!dstRoot) continue;
      function collectRelated(r: string) {
        const rp = r + "/";
        return virtualFiles.filter(
          (vf) => vf.path === r || vf.path.startsWith(rp)
        );
      }
      let related = collectRelated(root);
      // Fallback: si le chemin inclut .zip (cas où analyse aurait stocké avec extension)
      if (related.length === 0 && /\.zip$/i.test(root)) {
        const alt = root.replace(/\.zip$/i, "");
        related = collectRelated(alt);
      }
      // Si toujours rien, ignorer
      if (related.length === 0) continue;
      const effectiveRoot = related[0].path.startsWith(root)
        ? root
        : root.replace(/\.zip$/i, "");
      const rootPrefix = effectiveRoot + "/";
      const filePaths: string[] = [];
      for (const vf of related) {
        const relative =
          vf.path === effectiveRoot ? "" : vf.path.slice(rootPrefix.length);
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
      const root = project.projectRootPath.replace(/\/$/, "");
      function collectRelated(r: string) {
        const rp = r + "/";
        return virtualFiles.filter(
          (vf) => vf.path === r || vf.path.startsWith(rp)
        );
      }
      let related = collectRelated(root);
      if (related.length === 0 && /\.zip$/i.test(root)) {
        related = collectRelated(root.replace(/\.zip$/i, ""));
      }
      if (related.length === 0) continue;
      const effectiveRoot = related[0].path.startsWith(root)
        ? root
        : root.replace(/\.zip$/i, "");
      const rootPrefix = effectiveRoot + "/";
      for (const vf of related) {
        if (isCancelled?.()) {
          cancelled = true;
          break;
        }
        const relative =
          vf.path === effectiveRoot ? "" : vf.path.slice(rootPrefix.length);
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
