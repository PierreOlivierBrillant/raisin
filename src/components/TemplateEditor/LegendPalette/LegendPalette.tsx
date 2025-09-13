import React from "react";
import { legendPaletteStyles } from "./LegendPalette.styles";

export const LegendPalette: React.FC = () => (
  <div style={legendPaletteStyles.container}>
    {[
      { c: "#EF4444", label: "Racine", ring: "#7F1D1D" },
      { c: "#3B82F6", label: "Dossiers", ring: "#1D4ED8" },
      { c: "#10B981", label: "Fichiers", ring: "#047857" },
    ].map((item) => (
      <span key={item.label} style={legendPaletteStyles.item}>
        <span style={legendPaletteStyles.colorBox(item.c, item.ring)} />
        <span>{item.label}</span>
      </span>
    ))}
  </div>
);
