import JSZip from "jszip";
import type { IZipEntryMeta } from "../types/zip";

// Type étendu pour accéder à la taille non compressée si disponible.
type JsZipObjectLike = import("jszip").JSZipObject & {
  _data?: { uncompressedSize?: number };
};

function normalizePath(path: string): string {
  return path.replace(/\\+/g, "/").replace(/\/+$/, "");
}

function ensureDirectory(
  path: string,
  entries: IZipEntryMeta[],
  dirSet: Set<string>
) {
  if (!path || dirSet.has(path)) return;
  dirSet.add(path);
  entries.push({ path, isDir: true });
}

function ensureParentDirectories(
  path: string,
  entries: IZipEntryMeta[],
  dirSet: Set<string>
) {
  if (!path.includes("/")) return;
  const segments = path.split("/");
  segments.pop();
  if (!segments.length) return;
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    ensureDirectory(current, entries, dirSet);
  }
}

async function collectZipEntriesInternal(
  zip: JSZip,
  prefix: string,
  entries: IZipEntryMeta[],
  dirSet: Set<string>,
  fileSet: Set<string>
): Promise<void> {
  const items = Object.values(zip.files) as JsZipObjectLike[];
  for (const entry of items) {
    const clean = normalizePath(entry.name);
    if (!clean) continue;
    const fullPath = prefix ? `${prefix}${clean}` : clean;
    if (!fullPath) continue;

    ensureParentDirectories(fullPath, entries, dirSet);

    if (entry.dir) {
      ensureDirectory(fullPath, entries, dirSet);
      continue;
    }

    const isNestedZip = clean.toLowerCase().endsWith(".zip");
    if (isNestedZip) {
      ensureDirectory(fullPath, entries, dirSet);
      try {
        const data = await entry.async("arraybuffer");
        const nested = await JSZip.loadAsync(data);
        await collectZipEntriesInternal(
          nested,
          `${fullPath}/`,
          entries,
          dirSet,
          fileSet
        );
      } catch (error) {
        console.warn(
          "[zipEntryUtils] Impossible d'ouvrir l'archive imbriquée",
          fullPath,
          error
        );
        if (!fileSet.has(fullPath)) {
          fileSet.add(fullPath);
          entries.push({
            path: fullPath,
            isDir: false,
            size: entry._data?.uncompressedSize,
          });
        }
      }
      continue;
    }

    if (!fileSet.has(fullPath)) {
      fileSet.add(fullPath);
      entries.push({
        path: fullPath,
        isDir: false,
        size: entry._data?.uncompressedSize,
      });
    }
  }
}

export async function collectEntriesFromJSZip(
  zip: JSZip
): Promise<IZipEntryMeta[]> {
  const entries: IZipEntryMeta[] = [];
  const dirSet = new Set<string>();
  const fileSet = new Set<string>();
  await collectZipEntriesInternal(zip, "", entries, dirSet, fileSet);
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
  return entries;
}
