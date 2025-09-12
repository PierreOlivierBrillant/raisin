import React, { useState, useRef } from "react";
import type {
  HierarchyTemplate,
  StudentFolder,
} from "../../types";
import { generateStandardizedZip } from "../../services/generateStandardizedZip";
import { resultsStyles } from "./ResultsStep.styles";
import { GenerateZipPanel } from "./components/GenerateZipPanel";
import { ProjectBlock } from "./components/ProjectBlock";
import { ProjectDetailsModal } from "./components/ProjectDetailsModal";

interface ResultsStepProps {
  template: HierarchyTemplate | null;
  analysisResults: StudentFolder[];
  zipFile: File; // archive originale
  onResultsChange?: (updated: StudentFolder[]) => void; // quand l'utilisateur modifie un chemin
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  template,
  analysisResults,
  zipFile,
  onResultsChange,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentPath, setCurrentPath] = useState<string>("");
  const cancelRef = useRef<boolean>(false);
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
    // Maintenir compat matches (on laisse le premier projet)
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
        onGenerate={async () => {
          try {
            setIsGenerating(true);
            setProgress(0);
            cancelRef.current = false;
            await generateStandardizedZip(
              zipFile,
              analysisResults,
              { outputName: "standardized.zip" },
              (p, path) => {
                setProgress(p);
                if (path) setCurrentPath(path);
              },
              () => cancelRef.current
            );
          } catch (err: unknown) {
            interface CancelledLike { cancelled?: boolean }
            const cancelled =
              typeof err === "object" && err !== null && (err as CancelledLike).cancelled;
            if (!cancelled) console.error("Erreur génération ZIP", err);
          } finally {
            setIsGenerating(false);
            setTimeout(() => {
              setProgress(0);
              setCurrentPath("");
            }, 1200);
          }
        }}
        onCancel={() => {
          cancelRef.current = true;
        }}
      />
      <div style={{ ...resultsStyles.studentList, gap: ".75rem" }}>
        {analysisResults.map((student, si) => {
          const colorClass =
            student.overallScore >= 95
              ? "badge-success"
              : student.overallScore >= 80
              ? "badge-warning"
              : "badge-error";
          return (
            <div
              key={si}
              style={{ ...resultsStyles.studentCard, padding: ".6rem .75rem" }}
            >
              <div
                style={{
                  ...resultsStyles.studentCardHeader,
                  margin: "0 0 .4rem",
                }}
              >
                <h3 style={{ margin: 0, fontSize: ".8rem" }}>{student.name}</h3>
                <span className={`badge ${colorClass}`}>
                  {student.overallScore}% meilleur projet
                </span>
              </div>
              {student.expectedProjects !== undefined &&
                student.projects.length < (student.expectedProjects || 0) && (
                  <div
                    style={{
                      marginTop: ".25rem",
                      fontSize: ".55rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#92400e",
                      background: "#fef3c7",
                      padding: ".25rem .45rem",
                      border: "1px solid #fcd34d",
                      borderRadius: 4,
                    }}
                  >
                    <strong style={{ fontWeight: 600 }}>
                      {student.expectedProjects - student.projects.length}
                    </strong>
                    projet(s) non trouvés sur {student.expectedProjects}
                  </div>
                )}
              {student.projects.length === 0 && (
                <p style={{ fontSize: ".6rem", margin: ".4rem 0 0" }}>
                  Aucun projet ≥ 90% trouvé.
                </p>
              )}
              {student.projects.map((project, pjIndex) => (
                <ProjectBlock
                  key={project.projectRootPath}
                  project={project}
                  onPathChange={(val) => updateProjectPath(si, pjIndex, val)}
                  onOpenDetails={() =>
                    setDetailsTarget({
                      studentIndex: si,
                      projectIndex: pjIndex,
                    })
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
      {detailsTarget && (() => {
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
      {/* Overlay supprimé; la barre de progression suffit */}
    </div>
  );
};

// ProjectBlock externe maintenant
