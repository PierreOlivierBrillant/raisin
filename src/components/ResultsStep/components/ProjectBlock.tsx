import React from "react";
import type { StudentProject } from "../../../types";

interface ProjectBlockProps {
  project: StudentProject;
  onPathChange: (v: string) => void;
  onOpenDetails?: () => void;
}

export const ProjectBlock: React.FC<ProjectBlockProps> = ({
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
