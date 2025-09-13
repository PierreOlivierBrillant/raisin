import React from "react";
import type { StudentProject } from "../../../types";
import { projectBlockStyles as pbs } from "./ProjectBlock.styles";

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
    <div style={pbs.container}>
      <div style={pbs.header}>
        <strong style={pbs.name}>{project.projectRootPath}</strong>
        <span
          className={`badge ${
            project.score >= 95
              ? "badge-success"
              : project.score >= 90
              ? "badge-warning"
              : "badge-error"
          }`}
          style={pbs.scoreBadge}
        >
          {project.score}%
        </span>
        <button
          type="button"
          onClick={onOpenDetails}
          style={pbs.detailsBtn}
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
      <div style={pbs.pathRow}>
        <input
          value={project.newPath}
          onChange={(e) => onPathChange(e.target.value)}
          title="Nom standardisé"
          style={pbs.pathInput(project.newPath !== project.suggestedNewPath)}
        />
        {project.newPath !== project.suggestedNewPath && (
          <span style={pbs.modifiedBadge}>modifié</span>
        )}
      </div>
    </div>
  );
};
