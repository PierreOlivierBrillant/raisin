import React, { useMemo, useState } from "react";
import type { HierarchyTemplate, RootAnalysisResult } from "../../types";
import { resultsStyles } from "./ResultsStep.styles";
import { GenerateZipPanel } from "./GenerateZipPanel/GenerateZipPanel";
import { ProjectDetailsModal } from "./ProjectDetailsModal/ProjectDetailsModal";
import { StudentCard } from "./StudentCard/StudentCard";
import { useGenerateZip } from "../../hooks/useGenerateZip";
import type { ZipSource } from "../../types/zip";

interface ResultsStepProps {
  template: HierarchyTemplate | null;
  analysisResults: RootAnalysisResult[];
  /** Source analysée (fichier ZIP ou chemin local). */
  zipSource: ZipSource;
  /** Callback lorsque l'utilisateur modifie un chemin projet. */
  onResultsChange?: (updated: RootAnalysisResult[]) => void;
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
    groupIndex: number;
    studentIndex: number;
    projectIndex: number;
  } | null>(null);

  const flattenedResults = useMemo(
    () => analysisResults.flatMap((group) => group.folders),
    [analysisResults]
  );
  const hasAnyResult = flattenedResults.length > 0;

  const updateProjectPath = (
    groupIndex: number,
    studentIndex: number,
    projectIndex: number,
    newPath: string
  ) => {
    const clone: RootAnalysisResult[] = analysisResults.map((group) => ({
      ...group,
      folders: group.folders.map((folder) => ({
        ...folder,
        projects: folder.projects.map((project) => ({ ...project })),
        matches: [...folder.matches],
      })),
    }));
    const targetGroup = clone[groupIndex];
    if (!targetGroup) return;
    const targetFolder = targetGroup.folders[studentIndex];
    if (!targetFolder) return;
    const targetProject = targetFolder.projects[projectIndex];
    if (!targetProject) return;
    targetProject.newPath = newPath;
    if (targetFolder.projects[0]) {
      targetFolder.matches = [...targetFolder.projects[0].templateMatches];
      targetFolder.overallScore = targetFolder.projects[0].score;
    }
    onResultsChange?.(clone);
  };

  return (
    <div className="card">
      <GenerateZipPanel
        isGenerating={isGenerating}
        progress={progress}
        currentPath={currentPath}
        onGenerate={() => generate(zipSource, flattenedResults)}
        onCancel={cancel}
        disabled={!hasAnyResult}
        disabledReason={!hasAnyResult ? "Aucun dossier analysé." : undefined}
      />
      <div style={resultsStyles.groupsContainer}>
        {analysisResults.map((group, gi) => (
          <section
            key={group.rootId ?? `${group.rootName}-${gi}`}
            style={resultsStyles.groupSection}
          >
            <div style={resultsStyles.groupHeader}>
              <h4 style={resultsStyles.groupTitle}>
                {group.rootName || "Racine"}
              </h4>
              <span className="badge neutral">
                {group.folders.length} dossier(s)
              </span>
            </div>
            {group.folders.length > 0 ? (
              <div style={resultsStyles.studentList}>
                {group.folders.map((student, si) => (
                  <StudentCard
                    key={`${group.rootId ?? "root"}-${student.name}-${si}`}
                    student={student}
                    onUpdateProjectPath={(pj, newPath) =>
                      updateProjectPath(gi, si, pj, newPath)
                    }
                    onOpenProjectDetails={(pj) =>
                      setDetailsTarget({
                        groupIndex: gi,
                        studentIndex: si,
                        projectIndex: pj,
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div style={resultsStyles.emptyGroup}>
                Aucun dossier détecté pour cette racine.
              </div>
            )}
          </section>
        ))}
      </div>
      {detailsTarget &&
        (() => {
          const { groupIndex, studentIndex, projectIndex } = detailsTarget;
          const group = analysisResults[groupIndex];
          const student = group?.folders[studentIndex];
          const project = student?.projects[projectIndex];
          if (!group || !student || !project) return null;
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
