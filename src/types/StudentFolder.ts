import type { MatchResult } from "./MatchResult";

// Description d'un projet détecté dans le dossier d'un étudiant.
export interface StudentProject {
  // Chemin (dans l'archive) du dossier racine détecté pour ce projet.
  projectRootPath: string;
  // Score global de similarité (0-100) avec le modèle.
  score: number;
  // Nombre de nœuds du modèle trouvés.
  matchedNodesCount: number;
  // Nombre total de nœuds du modèle considérés (hors racine).
  totalTemplateNodes: number;
  // Détail par nœud du modèle.
  templateMatches: MatchResult[];
  // Nom suggéré (non modifié) pour le nouveau chemin (étudiant + _ + dossier projet).
  suggestedNewPath: string;
  // Nom actuel (modifiable par l'utilisateur). Initialisé avec suggestedNewPath.
  newPath: string;
  // Indique si l'utilisateur a modifié manuellement le chemin (newPath != suggestedNewPath)
  isRenamed?: boolean;
}

// Dossier analysé pour un étudiant donné.
export interface StudentFolder {
  name: string; // nom du dossier étudiant (niveau 1 sous le dossier racine choisi)
  overallScore: number; // meilleur score parmi les projets retenus (ou 0 si aucun)
  matches: MatchResult[]; // (legacy / rétrocompatibilité) laissé vide ou 1er projet.
  projects: StudentProject[]; // liste des projets retenus (maximum demandé par l'utilisateur)
  expectedProjects?: number; // nombre de projets que l'on tentait de trouver (projectsPerStudent)
}
