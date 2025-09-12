import type { HierarchyTemplate, StudentFolder } from "../types";

export interface AnalysisParams {
  template: HierarchyTemplate;
  zipFile: File;
  studentRootPath: string;
  projectsPerStudent: number;
}

// Simulation d'analyse : remplacera plus tard une vraie lecture/inspection du zip
export async function analyzeZipStructureMock(
  params: AnalysisParams
): Promise<StudentFolder[]> {
  // On simule une utilisation minimale des paramètres pour satisfaire le linter
  const { template, studentRootPath, projectsPerStudent } = params;
  void template; // (à retirer quand la vraie logique sera implémentée)
  void studentRootPath;
  void projectsPerStudent;
  await new Promise((r) => setTimeout(r, 1500));
  return [
    {
      name: "Étudiant_1",
      overallScore: 98,
      matches: [
        {
          templateNodeId: "src",
          foundPath: "/Étudiant_1/projet/src",
          score: 100,
          status: "found",
        },
        {
          templateNodeId: "components",
          foundPath: "/Étudiant_1/projet/src/components",
          score: 100,
          status: "found",
        },
      ],
    },
    {
      name: "Étudiant_2",
      overallScore: 90,
      matches: [
        {
          templateNodeId: "src",
          foundPath: "/Étudiant_2/source",
          score: 90,
          status: "found",
        },
        {
          templateNodeId: "components",
          foundPath: "",
          score: 0,
          status: "missing",
        },
      ],
    },
  ];
}
