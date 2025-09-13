import React from "react";
import { progressBarStyles } from "./ProgressBar.styles";

interface ProgressBarProps {
  /** Valeur normalisée 0..1. */
  value: number;
  /** Hauteur en pixels. */
  height?: number;
  /** Affiche le pourcentage numérique. */
  showPercent?: boolean;
}

/** Barre de progression simple linéaire. */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  height = 6,
  showPercent,
}) => {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div style={progressBarStyles.outer}>
      <div style={progressBarStyles.track(height)}>
        <span
          style={
            {
              ...progressBarStyles.bar,
              width: pct.toFixed(1) + "%",
            } as React.CSSProperties
          }
        />
      </div>
      {showPercent && (
        <div style={progressBarStyles.percent}>{pct.toFixed(1)}%</div>
      )}
    </div>
  );
};

export default ProgressBar;
