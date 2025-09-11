import type { MatchResult } from "./MatchResult";

// Dossier analysé pour un étudiant donné.
export interface StudentFolder {
  name: string;
  matches: MatchResult[];
  overallScore: number;
}
