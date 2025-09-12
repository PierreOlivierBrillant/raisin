import React from "react";
import type { StudentFolder } from "../../../types";
import { ProjectBlock } from "./ProjectBlock";
import { scoreClass } from "../../ResultsStep/scoreClass";
import { MissingProjectsNotice } from "./MissingProjectsNotice";

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
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: ".5rem",
        padding: ".6rem .75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "0 0 .4rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: ".8rem" }}>{student.name}</h3>
        <span className={`badge ${badge}`}>
          {student.overallScore}% meilleur projet
        </span>
      </div>
      {student.expectedProjects !== undefined && (
        <MissingProjectsNotice
          missing={(student.expectedProjects || 0) - student.projects.length}
          expected={student.expectedProjects || 0}
        />
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
          onPathChange={(val) => onUpdateProjectPath(pjIndex, val)}
          onOpenDetails={() => onOpenProjectDetails(pjIndex)}
        />
      ))}
    </div>
  );
};
