import React from "react";

interface MissingProjectsNoticeProps {
  missing: number;
  expected: number;
}

/** Affiche un badge d'avertissement si des projets attendus sont absents. */
export const MissingProjectsNotice: React.FC<MissingProjectsNoticeProps> = ({
  missing,
  expected,
}) => {
  if (missing <= 0) return null;
  return (
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
      <strong style={{ fontWeight: 600 }}>{missing}</strong>
      projet(s) non trouvés sur {expected}
    </div>
  );
};
