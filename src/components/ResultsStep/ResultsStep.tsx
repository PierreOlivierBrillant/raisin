import React from "react";
import { AlertCircle, CheckCircle, Download } from "lucide-react";
import type {
  HierarchyTemplate,
  StudentFolder,
  StudentProject,
} from "../../types";
import { resultsStyles } from "./ResultsStep.styles";

interface ResultsStepProps {
  template: HierarchyTemplate | null;
  analysisResults: StudentFolder[];
  onGenerateStandardizedZip?: (updated: StudentFolder[]) => void;
  onResultsChange?: (updated: StudentFolder[]) => void; // quand l'utilisateur modifie un chemin
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  template,
  analysisResults,
  onGenerateStandardizedZip,
  onResultsChange,
}) => {
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
        <button
          onClick={() => onGenerateStandardizedZip?.(analysisResults)}
          className="btn btn-success"
        >
          <Download size={16} /> Générer ZIP standardisé
        </button>
      </div>
      <div style={resultsStyles.studentList}>
        {analysisResults.map((student, si) => {
          const colorClass =
            student.overallScore >= 95
              ? "badge-success"
              : student.overallScore >= 80
              ? "badge-warning"
              : "badge-error";
          return (
            <div key={si} style={resultsStyles.studentCard}>
              <div style={resultsStyles.studentCardHeader}>
                <h3 style={{ margin: 0 }}>{student.name}</h3>
                <span className={`badge ${colorClass}`}>
                  {student.overallScore}% meilleur projet
                </span>
              </div>
              {student.projects.length === 0 && (
                <p style={{ fontSize: ".7rem", margin: ".5rem 0 0" }}>
                  Aucun projet ≥ 90% trouvé.
                </p>
              )}
              {student.projects.map((project, pjIndex) => (
                <ProjectBlock
                  key={project.projectRootPath}
                  project={project}
                  template={template}
                  onPathChange={(val) => updateProjectPath(si, pjIndex, val)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ProjectBlockProps {
  project: StudentProject;
  template: HierarchyTemplate | null;
  onPathChange: (v: string) => void;
}

const ProjectBlock: React.FC<ProjectBlockProps> = ({
  project,
  template,
  onPathChange,
}) => {
  return (
    <div
      style={{
        marginTop: ".75rem",
        borderTop: "1px solid #e5e7eb",
        paddingTop: ".5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: ".5rem",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: ".75rem" }}>
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
        >
          {project.score}%
        </span>
        <span style={{ fontSize: ".6rem", opacity: 0.7 }}>
          {project.matchedNodesCount}/{project.totalTemplateNodes} nœuds
        </span>
      </div>
      <div
        style={{
          marginTop: ".5rem",
          display: "flex",
          flexDirection: "column",
          gap: ".4rem",
        }}
      >
        <label style={{ fontSize: ".6rem", fontWeight: 500 }}>
          Nouveau chemin proposé
        </label>
        <input
          value={project.newPath}
          onChange={(e) => onPathChange(e.target.value)}
          style={{
            fontSize: ".7rem",
            padding: ".3rem .4rem",
            border: "1px solid #d1d5db",
            borderRadius: 4,
          }}
        />
      </div>
      <details style={{ marginTop: ".5rem" }}>
        <summary style={{ cursor: "pointer", fontSize: ".6rem" }}>
          Détails des correspondances
        </summary>
        <div style={{ display: "grid", gap: ".4rem", marginTop: ".4rem" }}>
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
              }}
            >
              <span style={{ fontSize: ".6rem" }}>
                {template?.nodes[m.templateNodeId]?.name || m.templateNodeId}
              </span>
              <span
                style={{
                  fontSize: ".6rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {m.status === "found" ? (
                  <CheckCircle size={14} color="#10b981" />
                ) : (
                  <AlertCircle size={14} color="#ef4444" />
                )}
                {m.score}%
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};
