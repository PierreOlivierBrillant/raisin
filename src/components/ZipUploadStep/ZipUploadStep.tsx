import React, { useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import type { HierarchyTemplate } from "../../types";
import { zipUploadStyles } from "./ZipUploadStep.styles";
import { zipUploadExtraStyles } from "./ZipUploadStep.extra.styles";
import type { ZipSource } from "../../types/zip";

interface ZipUploadStepProps {
  template: HierarchyTemplate | null;
  onZipChosen: (source: ZipSource) => void;
  onNext?: () => void;
  disabled?: boolean; // future use
}

export const ZipUploadStep: React.FC<ZipUploadStepProps> = ({
  template,
  onZipChosen,
  onNext,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSource, setSelectedSource] = useState<ZipSource | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !template) return;
    const source: ZipSource = { kind: "file", file: f, label: f.name };
    setSelectedSource(source);
    onZipChosen(source);
  };

  const selectionLabel = selectedSource?.label;

  return (
    <div className="card" style={zipUploadStyles.card as React.CSSProperties}>
      <div style={zipUploadStyles.uploadZone}>
        <FolderOpen size={48} color="#9ca3af" />
        <p style={zipUploadStyles.uploadHint}>
          Glissez-déposez votre fichier ZIP ici ou cliquez pour sélectionner
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileUpload}
          hidden
        />
        <div style={zipUploadExtraStyles.actions}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary"
          >
            {selectionLabel ? "Changer de fichier" : "Sélectionner un fichier"}
          </button>
          {selectedSource && (
            <button className="btn btn-secondary" onClick={onNext}>
              Étape suivante
            </button>
          )}
        </div>
        {selectionLabel && (
          <p style={zipUploadExtraStyles.selectedFile}>
            Source sélectionnée : <strong>{selectionLabel}</strong>
          </p>
        )}
      </div>
    </div>
  );
};
