import React from "react";

interface ZipBreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

/** Fil d'Ariane de navigation dans l'arborescence ZIP. */
export const ZipBreadcrumb: React.FC<ZipBreadcrumbProps> = ({
  currentPath,
  onNavigate,
}) => {
  const segments = currentPath.split("/").filter(Boolean);
  const paths = segments.map((_, idx) => segments.slice(0, idx + 1).join("/"));
  return (
    <nav className="breadcrumb">
      <button type="button" onClick={() => onNavigate("")} className="link">
        Racine
      </button>
      {segments.map((seg, i) => (
        <React.Fragment key={paths[i]}>
          <span className="sep">/</span>
          <button
            type="button"
            onClick={() => onNavigate(paths[i])}
            className="link"
          >
            {seg}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};
