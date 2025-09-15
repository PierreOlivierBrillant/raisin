import type { IZipEntryMeta, IZipReader } from "../types/zip";

// Déclaration minimale de l'API Tauri globale (évite any)
declare global {
  interface Window {
    __TAURI__?: {
      tauri: {
        invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
      };
    };
  }
}

// Détection simple présence Tauri
const isTauri = typeof window !== 'undefined' && !!window.__TAURI__;

interface JsZipObjectLike {
  dir: boolean;
  // propriété interne taille si dispo
  _data?: { uncompressedSize?: number };
}

// Adapter minimal : list_entries (placeholder dossier local ou futur contenu zip).
export function createTauriZipReader(sourcePath: string): IZipReader {
  return {
    kind: 'tauri',
    async listEntries(): Promise<IZipEntryMeta[]> {
      if (!isTauri || !window.__TAURI__) throw new Error('Tauri non détecté');
      const entries: IZipEntryMeta[] = await window.__TAURI__.tauri.invoke('list_entries', { path: sourcePath });
      return entries.map(e => ({ ...e, path: e.path.replace(/\\+/g, '/').replace(/\/$/, '') }));
    },
  };
}

export function detectEnvironmentZipReader(file: File | null, localPath?: string): IZipReader | null {
  if (isTauri && localPath) return createTauriZipReader(localPath);
  if (file) {
    return {
      kind: 'jszip',
      listEntries: async () => {
        const JSZip = (await import('jszip')).default;
        const data = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(data);
        const out: IZipEntryMeta[] = [];
        zip.forEach((relativePath: string, entry: JsZipObjectLike) => {
          const clean = relativePath.replace(/\\/g, '/');
          if (!clean) return;
          const normalized = clean.endsWith('/') ? clean.slice(0, -1) : clean;
          out.push({ path: normalized, isDir: entry.dir, size: entry._data?.uncompressedSize });
        });
        return out;
      },
      capabilities: { expandNestedZipsClientSide: true }
    };
  }
  return null;
}
