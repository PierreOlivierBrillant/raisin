import React, { useState, useRef } from "react";
import { Download } from "lucide-react";
import type {
  HierarchyTemplate,
  StudentFolder,
  StudentProject,
} from "../../types";
import { generateStandardizedZip } from "../../services/generateStandardizedZip";
import { resultsStyles } from "./ResultsStep.styles";

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
      <div style={resultsStyles.headerRow}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: ".6rem",
            marginBottom: "1.25rem",
            flexGrow: 1,
          }}
        >
          <button
            onClick={async () => {
              try {
                setIsGenerating(true);
                setProgress(0);
                cancelRef.current = false;
                await generateStandardizedZip(
                  zipFile,
                  analysisResults,
                  {
                    outputName: "standardized.zip",
                  },
                  (p, path) => {
                    setProgress(p);
                    if (path) setCurrentPath(path);
                  },
                  () => cancelRef.current
                );
              } catch (err: unknown) {
                interface CancelledLike {
                  cancelled?: boolean;
                }
                const cancelled =
                  typeof err === "object" &&
                  err !== null &&
                  (err as CancelledLike).cancelled;
                if (!cancelled) {
                  console.error("Erreur génération ZIP", err);
                }
              } finally {
                setIsGenerating(false);
                setTimeout(() => {
                  setProgress(0);
                  setCurrentPath("");
                }, 1200);
              }
            }}
            className="btn btn-success"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              textAlign: "center",
              width: "100%",
            }}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    marginRight: 6,
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Génération…
              </>
            ) : (
              <>
                <Download size={16} /> Générer ZIP standardisé
              </>
            )}
          </button>
          {isGenerating && (
            <button
              type="button"
              onClick={() => {
                cancelRef.current = true;
              }}
              className="btn btn-error"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                textAlign: "center",
                width: "100%",
              }}
            >
              Annuler
            </button>
          )}
          {isGenerating && (
            <div style={{ width: "100%", marginTop: ".75rem" }}>
              <div
                style={{
                  fontSize: ".55rem",
                  marginBottom: 2,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "#374151",
                }}
              >
                {currentPath ? `Copie: ${currentPath}` : "Préparation..."}
              </div>
              <div
                style={{
                  height: 6,
                  background: "#e5e7eb",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(
                      100,
                      Math.max(0, progress * 100)
                    ).toFixed(1)}%`,
                    background: "linear-gradient(90deg,#10b981,#059669)",
                    transition: "width .25s ease",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: ".55rem",
                  marginTop: 4,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  opacity: 0.7,
                }}
              >
                {(progress * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
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
      {detailsTarget &&
        (() => {
          const { studentIndex, projectIndex } = detailsTarget;
          const student = analysisResults[studentIndex];
          const project = student?.projects[projectIndex];
          if (!student || !project) return null;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setDetailsTarget(null)}
            >
              <div
                style={{
                  background: "#fff",
                  width: "min(640px,90%)",
                  maxHeight: "80vh",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 8,
                  boxShadow: "0 8px 28px -4px rgba(0,0,0,0.35)",
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    padding: ".7rem .85rem",
                    borderBottom: "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: ".75rem" }}>
                      {student.name} – Projet
                    </strong>
                    <span
                      style={{
                        fontSize: ".55rem",
                        color: "#6b7280",
                        wordBreak: "break-all",
                      }}
                    >
                      {project.projectRootPath}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: ".6rem", padding: ".3rem .55rem" }}
                    onClick={() => setDetailsTarget(null)}
                  >
                    Fermer
                  </button>
                </div>
                <div
                  style={{
                    padding: ".65rem .75rem 1rem",
                    overflow: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: ".55rem",
                    fontSize: ".6rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: ".6rem",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span
                      className={`badge ${
                        project.score >= 95
                          ? "badge-success"
                          : project.score >= 90
                          ? "badge-warning"
                          : "badge-error"
                      }`}
                    >
                      Score {project.score}%
                    </span>
                    <span style={{ opacity: 0.7 }}>
                      {project.matchedNodesCount}/{project.totalTemplateNodes}{" "}
                      nœuds
                    </span>
                    {project.newPath !== project.suggestedNewPath && (
                      <span
                        style={{
                          background: "#fef3c7",
                          border: "1px solid #fcd34d",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: ".55rem",
                        }}
                      >
                        Chemin modifié
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: ".35rem",
                      maxHeight: "45vh",
                      overflow: "auto",
                      paddingRight: 4,
                    }}
                  >
                    {project.templateMatches.map((m) => (
                      <div
                        key={m.templateNodeId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "#f9fafb",
                          padding: ".25rem .4rem",
                          borderRadius: 4,
                          border: "1px solid #f3f4f6",
                        }}
                      >
                        <span style={{ fontSize: ".55rem" }}>
                          {template?.nodes[m.templateNodeId]?.name ||
                            m.templateNodeId}
                        </span>
                        <span
                          style={{
                            fontSize: ".55rem",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {m.status === "found" ? "✔" : "✖"} {m.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      {/* Overlay supprimé; la barre de progression suffit */}
    </div>
  );
};

interface ProjectBlockProps {
  project: StudentProject;
  onPathChange: (v: string) => void;
  onOpenDetails?: () => void;
}

const ProjectBlock: React.FC<ProjectBlockProps> = ({
  project,
  onPathChange,
  onOpenDetails,
}) => {
  return (
    <div
      style={{
        marginTop: ".55rem",
        borderTop: "1px solid #e5e7eb",
        paddingTop: ".45rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: ".4rem",
        }}
      >
        <strong
          style={{ fontSize: ".65rem", fontWeight: 600, lineHeight: 1.2 }}
        >
          {project.projectRootPath}
        </strong>
        <span
          className={`badge ${
            project.score >= 95
              ? "badge-success"
              : project.score >= 90
              ? "badge-warning"
              : "badge-error"
          }`}
          style={{ fontSize: ".55rem" }}
        >
          {project.score}%
        </span>
        <button
          type="button"
          onClick={onOpenDetails}
          style={{
            fontSize: ".55rem",
            padding: ".28rem .55rem",
            lineHeight: 1.1,
            background: "#2563eb", // bleu vif
            color: "#fff",
            fontWeight: 600,
            border: "1px solid #1d4ed8",
            borderRadius: 4,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            transition: "background .15s, box-shadow .15s, transform .12s",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            position: "relative",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1d4ed8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#2563eb";
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline =
              "2px solid #93c5fd";
            (e.currentTarget as HTMLButtonElement).style.outlineOffset = "1px";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
            (e.currentTarget as HTMLButtonElement).style.outlineOffset = "0";
          }}
        >
          Détails
        </button>
      </div>
      <div
        style={{
          marginTop: ".35rem",
          display: "flex",
          alignItems: "center",
          gap: ".35rem",
        }}
      >
        <input
          value={project.newPath}
          onChange={(e) => onPathChange(e.target.value)}
          title="Nom standardisé"
          style={{
            fontSize: ".6rem",
            padding: ".25rem .35rem",
            border:
              project.newPath !== project.suggestedNewPath
                ? "1px solid #f59e0b"
                : "1px solid #d1d5db",
            background:
              project.newPath !== project.suggestedNewPath
                ? "#fff7ed"
                : "white",
            borderRadius: 4,
            flex: 1,
            minWidth: 140,
            color:
              project.newPath !== project.suggestedNewPath
                ? "#7c2d12"
                : "#111827",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            letterSpacing: 0.2,
          }}
        />
        {project.newPath !== project.suggestedNewPath && (
          <span
            style={{
              fontSize: ".5rem",
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              padding: "2px 4px",
              borderRadius: 3,
              color: "#92400e",
              whiteSpace: "nowrap",
            }}
          >
            modifié
          </span>
        )}
      </div>
    </div>
  );
};
