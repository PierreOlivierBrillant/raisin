import React, { useState } from "react";
import type { HierarchyTemplate, StudentFolder } from "../../types";
import { resultsStyles } from "./ResultsStep.styles";
import { GenerateZipPanel } from "./GenerateZipPanel/GenerateZipPanel";
import { ProjectDetailsModal } from "./ProjectDetailsModal/ProjectDetailsModal";
import { StudentCard } from "./StudentCard/StudentCard";
import { useGenerateZip } from "../../hooks/useGenerateZip";
import type { ZipSource } from "../../types/zip";

interface ResultsStepProps {
  template: HierarchyTemplate | null;
  analysisResults: StudentFolder[];
  /** Source analysée (fichier ZIP ou chemin local). */
  zipSource: ZipSource;
  /** Callback lorsque l'utilisateur modifie un chemin projet. */
  onResultsChange?: (updated: StudentFolder[]) => void;
}

/** Affiche les résultats d'analyse et permet la génération de l'archive standardisée. */
export const ResultsStep: React.FC<ResultsStepProps> = ({
  template,
  analysisResults,
  zipSource,
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
        onGenerate={() => generate(zipSource, analysisResults)}
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
