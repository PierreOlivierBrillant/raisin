import React from "react";
import type { HierarchyTemplate, StudentProject } from "../../../types";

interface ProjectDetailsModalProps {
  project: StudentProject;
  studentName: string;
  template: HierarchyTemplate | null;
  onClose: () => void;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  project,
  studentName,
  template,
  onClose,
}) => {
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
      onClick={onClose}
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
              {studentName} – Projet
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
            onClick={onClose}
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
              {project.matchedNodesCount}/{project.totalTemplateNodes} nœuds
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
};
