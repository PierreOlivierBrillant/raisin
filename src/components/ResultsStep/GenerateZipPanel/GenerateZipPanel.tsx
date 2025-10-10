import React from "react";
import { Download } from "lucide-react";
import { resultsStyles } from "../ResultsStep.styles";
import { ProgressBar } from "../../ProgressBar/ProgressBar";
import { generateZipPanelStyles as gzs } from "./GenerateZipPanel.styles";

interface GenerateZipPanelProps {
  isGenerating: boolean;
  progress: number;
  currentPath: string;
  onGenerate: () => Promise<void> | void;
  onCancel: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export const GenerateZipPanel: React.FC<GenerateZipPanelProps> = ({
  isGenerating,
  progress,
  currentPath,
  onGenerate,
  onCancel,
  disabled,
  disabledReason,
}) => {
  return (
    <div style={resultsStyles.headerRow}>
      <div style={gzs.column}>
        <button
          onClick={onGenerate}
          className="btn btn-success"
          style={gzs.primaryButton}
          disabled={isGenerating || disabled}
        >
          {isGenerating ? (
            <>
              <span style={gzs.spinner} />
              Génération…
            </>
          ) : (
            <>
              <Download size={16} /> Générer ZIP standardisé
            </>
          )}
        </button>
        {isGenerating && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-error"
            style={gzs.cancelButton}
          >
            Annuler
          </button>
        )}
        {disabled && disabledReason && !isGenerating && (
          <div
            style={{ marginTop: ".5rem", fontSize: ".85rem", color: "#b45309" }}
          >
            {disabledReason}
          </div>
        )}
        {isGenerating && (
          <div style={gzs.progressWrapper}>
            <div style={gzs.progressLabel}>
              {currentPath ? `Copie: ${currentPath}` : "Préparation..."}
            </div>
            <ProgressBar value={progress} showPercent />
          </div>
        )}
      </div>
    </div>
  );
};
