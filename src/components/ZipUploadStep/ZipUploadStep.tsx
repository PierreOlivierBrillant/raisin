import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { HierarchyTemplate } from "../../types";
import { zipUploadStyles } from "./ZipUploadStep.styles";
import { zipUploadExtraStyles } from "./ZipUploadStep.extra.styles";

interface ZipUploadStepProps {
  template: HierarchyTemplate | null;
  onZipChosen: (file: File) => void;
  onNext?: () => void;
  disabled?: boolean; // future use
}

export const ZipUploadStep: React.FC<ZipUploadStepProps> = ({
  template,
  onZipChosen,
  onNext,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !template) return;
    setZipFile(f);
    onZipChosen(f);
  };

  return (
    <div className="card" style={zipUploadStyles.card as React.CSSProperties}>
      <div style={zipUploadStyles.uploadZone}>
        <Upload size={48} color="#9ca3af" />
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
            {zipFile ? "Changer de fichier" : "Sélectionner un fichier"}
          </button>
          {zipFile && (
            <button className="btn btn-secondary" onClick={onNext}>
              Étape suivante
            </button>
          )}
        </div>
        {zipFile && (
          <p style={zipUploadExtraStyles.selectedFile}>
            Fichier sélectionné : <strong>{zipFile.name}</strong>
          </p>
        )}
      </div>
    </div>
  );
};
