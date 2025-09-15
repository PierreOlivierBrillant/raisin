// Abstractions ZIP pour unifier Web (JS) et Desktop (Tauri/Rust)
// Utilisation: fournir un IZipReader à l'analyse afin d'éviter de charger en mémoire entière des archives multi‑Go.

export interface IZipEntryMeta {
  path: string;          // Chemin normalisé sans slash final
  isDir: boolean;        // true si répertoire
  size?: number;         // Taille en octets (optionnel mais utile pour progress / heuristiques)
}

export interface IZipReaderCapabilities {
  // Le reader peut-il développer côté client des ZIP imbriqués ? (JSZip)
  expandNestedZipsClientSide?: boolean;
}

export interface IZipReader {
  kind: string; // identifiant (ex: 'jszip', 'tauri')
  listEntries(): Promise<IZipEntryMeta[]>;
  // Ouverture d'un flux paresseux sur un fichier (optionnel, surtout Desktop)
  openEntryStream?(path: string): AsyncIterable<Uint8Array>;
  capabilities?: IZipReaderCapabilities;
}

// Writer générique pour création d'un ZIP standardisé en streaming
export interface IZipWriterResult {
  kind: 'path' | 'blob';
  // Desktop: chemin disque; Web: Blob
  value: string | Blob;
}

export interface IZipWriterOptions {
  zip64?: boolean;             // Forcer Zip64 (par défaut auto si >4Go)
  compression?: 'store' | 'deflate';
  compressionLevel?: number;   // 0-9 si deflate
}

export interface IZipWriter {
  addDirectory(path: string): Promise<void>;
  addFile(path: string, data: AsyncIterable<Uint8Array> | Uint8Array | string | Blob): Promise<void>;
  finalize(): Promise<IZipWriterResult>;
}

// Spécification d'un plan de génération pour le standardisation
export interface StandardizationPlanFile {
  sourcePath: string;      // chemin original (dans archive source ou FS temp)
  targetPath: string;      // chemin dans l'archive finale
  mode?: 'copy' | 'text-transform';
  // future: transformation (ex: normalisation EOL)
}

export interface StandardizationPlan {
  files: StandardizationPlanFile[];
  zipOptions?: IZipWriterOptions;
}
