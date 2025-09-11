// Résultat de correspondance entre un nœud du modèle et ce qui est trouvé.
export interface MatchResult {
  templateNodeId: string;
  foundPath: string;
  score: number;
  status: "found" | "missing" | "partial";
}
