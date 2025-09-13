import React from "react";
import type { HierarchyTemplate, StudentProject } from "../../../types";
import { Modal } from "../../Modal/Modal";
import { projectDetailsModalStyles as pdms } from "./ProjectDetailsModal.styles";

interface ProjectDetailsModalProps {
  project: StudentProject;
  studentName: string;
  template: HierarchyTemplate | null;
  onClose: () => void;
}

/** Modal affichant les correspondances d'un projet étudiant face au modèle. */
export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  project,
  studentName,
  template,
  onClose,
}) => {
  return (
    <Modal onClose={onClose} ariaLabel="Détails du projet">
      <div style={pdms.header}>
        <div style={pdms.headerInfo}>
          <strong style={pdms.studentName}>{studentName} – Projet</strong>
          <span style={pdms.projectPath}>{project.projectRootPath}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={pdms.closeButton}
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
      <div style={pdms.body}>
        <div style={pdms.scoreRow}>
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
            <span style={pdms.modifiedBadge}>Chemin modifié</span>
          )}
        </div>
        <div style={pdms.matchesGrid}>
          {project.templateMatches.map((m) => (
            <div key={m.templateNodeId} style={pdms.match}>
              <span style={pdms.matchPath}>
                {template?.nodes[m.templateNodeId]?.name || m.templateNodeId}
              </span>
              <span style={pdms.matchStatus}>
                {m.status === "found" ? "✔" : "✖"} {m.score}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
