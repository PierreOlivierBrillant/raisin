import React from "react";
import { Download, Upload } from "lucide-react";
import { templateToolbarStyles } from "./TemplateToolbar.styles";

interface TemplateToolbarProps {
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const TemplateToolbar: React.FC<TemplateToolbarProps> = ({
  onExport,
  onImport,
}) => {
  return (
    <div style={templateToolbarStyles.container}>
      <button
        onClick={onExport}
        className="btn btn-success btn-compact"
        title="Exporter le modèle"
      >
        <Download size={14} /> Exporter
      </button>
      <label
        className="btn btn-primary btn-compact file-label"
        title="Importer un modèle"
        style={templateToolbarStyles.fileLabel}
      >
        <input
          type="file"
          accept=".yml,.yaml,text/yaml,application/x-yaml"
          onChange={onImport}
          hidden
        />
        <Upload size={14} /> Importer
      </label>
    </div>
  );
};
