import React from "react";

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
    <div style={{ width: "100%" }}>
      <div
        style={{
          height,
          background: "#e5e7eb",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: pct.toFixed(1) + "%",
            background: "linear-gradient(90deg,#10b981,#059669)",
            transition: "width .25s ease",
          }}
        />
      </div>
      {showPercent && (
        <div
          style={{
            fontSize: ".55rem",
            marginTop: 4,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            opacity: 0.7,
          }}
        >
          {pct.toFixed(1)}%
        </div>
      )}
    </div>
  );
};
