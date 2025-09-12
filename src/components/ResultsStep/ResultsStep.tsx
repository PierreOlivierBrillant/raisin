import React, { useState } from "react";
import type { HierarchyTemplate, StudentFolder } from "../../types";
import { resultsStyles } from "./ResultsStep.styles";
import { GenerateZipPanel } from "./components/GenerateZipPanel";
import { ProjectDetailsModal } from "./components/ProjectDetailsModal";
import { StudentCard } from "./components/StudentCard";
import { useGenerateZip } from "../../hooks/useGenerateZip";

interface ResultsStepProps {
  template: HierarchyTemplate | null;
  analysisResults: StudentFolder[];
  /** Archive ZIP analysée en entrée. */
  zipFile: File;
  /** Callback lorsque l'utilisateur modifie un chemin projet. */
  onResultsChange?: (updated: StudentFolder[]) => void;
}

/** Affiche les résultats d'analyse et permet la génération de l'archive standardisée. */
export const ResultsStep: React.FC<ResultsStepProps> = ({
  template,
  analysisResults,
  zipFile,
  onResultsChange,
}) => {
  const { progress, currentPath, isGenerating, generate, cancel } =
    useGenerateZip();
  const [detailsTarget, setDetailsTarget] = useState<{
    studentIndex: number;
    projectIndex: number;
  } | null>(null);
  if (!analysisResults.length) return null;

  const updateProjectPath = (
    studentIndex: number,
    projectIndex: number,
    newPath: string
  ) => {
    const clone: StudentFolder[] = analysisResults.map((s) => ({
      ...s,
      projects: s.projects.map((p) => ({ ...p })),
    }));
    const proj = clone[studentIndex].projects[projectIndex];
    proj.newPath = newPath;
    if (clone[studentIndex].projects[0]) {
      clone[studentIndex].matches =
        clone[studentIndex].projects[0].templateMatches;
      clone[studentIndex].overallScore = clone[studentIndex].projects[0].score;
    }
    onResultsChange?.(clone);
  };

  return (
    <div className="card">
      <GenerateZipPanel
        isGenerating={isGenerating}
        progress={progress}
        currentPath={currentPath}
        onGenerate={() => generate(zipFile, analysisResults)}
        onCancel={cancel}
      />
      <div style={{ ...resultsStyles.studentList, gap: ".75rem" }}>
        {analysisResults.map((student, si) => (
          <StudentCard
            key={si}
            student={student}
            onUpdateProjectPath={(pj, newPath) =>
              updateProjectPath(si, pj, newPath)
            }
            onOpenProjectDetails={(pj) =>
              setDetailsTarget({ studentIndex: si, projectIndex: pj })
            }
          />
        ))}
      </div>
      {detailsTarget &&
        (() => {
          const { studentIndex, projectIndex } = detailsTarget;
          const student = analysisResults[studentIndex];
          const project = student?.projects[projectIndex];
          if (!student || !project) return null;
          return (
            <ProjectDetailsModal
              project={project}
              studentName={student.name}
              template={template}
              onClose={() => setDetailsTarget(null)}
            />
          );
        })()}
    </div>
  );
};
