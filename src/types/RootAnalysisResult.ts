import type { StudentFolder } from "./StudentFolder";

/** Regroupe le résultat d'analyse pour une racine spécifique. */
export interface RootAnalysisResult {
  rootId: string;
  rootName: string;
  folders: StudentFolder[];
}
