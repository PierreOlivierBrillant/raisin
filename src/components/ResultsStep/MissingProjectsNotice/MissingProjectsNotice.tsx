import React from "react";
import { missingProjectsNoticeStyles as mpn } from "./MissingProjectsNotice.styles";

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
    <div style={mpn.container}>
      <strong style={mpn.strong}>{missing}</strong>
      projet(s) non trouvés sur {expected}
    </div>
  );
};
