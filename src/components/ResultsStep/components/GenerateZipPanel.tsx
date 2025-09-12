import React from "react";
import { Download } from "lucide-react";
import { resultsStyles } from "../ResultsStep.styles";
import { ProgressBar } from "../../common/ProgressBar";

interface GenerateZipPanelProps {
  isGenerating: boolean;
  progress: number;
  currentPath: string;
  onGenerate: () => Promise<void> | void;
  onCancel: () => void;
}

export const GenerateZipPanel: React.FC<GenerateZipPanelProps> = ({
  isGenerating,
  progress,
  currentPath,
  onGenerate,
  onCancel,
}) => {
  return (
    <div style={resultsStyles.headerRow}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ".6rem",
          marginBottom: "1.25rem",
          flexGrow: 1,
        }}
      >
        <button
          onClick={onGenerate}
          className="btn btn-success"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            textAlign: "center",
            width: "100%",
          }}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid #fff",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  marginRight: 6,
                  animation: "spin 0.8s linear infinite",
                }}
              />
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              textAlign: "center",
              width: "100%",
            }}
          >
            Annuler
          </button>
        )}
        {isGenerating && (
          <div style={{ width: "100%", marginTop: ".75rem" }}>
            <div
              style={{
                fontSize: ".55rem",
                marginBottom: 2,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "#374151",
              }}
            >
              {currentPath ? `Copie: ${currentPath}` : "Préparation..."}
            </div>
            <ProgressBar value={progress} showPercent />
          </div>
        )}
      </div>
    </div>
  );
};
