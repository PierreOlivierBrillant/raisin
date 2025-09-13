import React from "react";
import type { StudentFolder } from "../../../types";
import { ProjectBlock } from "../ProjectBlock/ProjectBlock";
import { scoreClass } from "../scoreClass";
import { MissingProjectsNotice } from "../MissingProjectsNotice/MissingProjectsNotice";
import { studentCardStyles as scs } from "./StudentCard.styles";

interface StudentCardProps {
  student: StudentFolder;
  onUpdateProjectPath: (projectIndex: number, newPath: string) => void;
  onOpenProjectDetails: (projectIndex: number) => void;
}

/** Carte regroupant les projets d'un étudiant et leurs actions associées. */
export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  onUpdateProjectPath,
  onOpenProjectDetails,
}) => {
  const badge = scoreClass(student.overallScore);
  return (
    <div style={scs.card}>
      <div style={scs.header}>
        <h3 style={scs.title}>{student.name}</h3>
        <span className={`badge ${badge}`}>{student.overallScore}%</span>
      </div>
      {student.expectedProjects !== undefined && (
        <MissingProjectsNotice
          missing={(student.expectedProjects || 0) - student.projects.length}
          expected={student.expectedProjects || 0}
        />
      )}
      {student.projects.length === 0 && (
        <p style={scs.empty}>Aucun projet ≥ 90% trouvé.</p>
      )}
      {student.projects.map((project, pjIndex) => (
        <ProjectBlock
          key={project.projectRootPath}
          project={project}
          onPathChange={(val) => onUpdateProjectPath(pjIndex, val)}
          onOpenDetails={() => onOpenProjectDetails(pjIndex)}
        />
      ))}
    </div>
  );
};
