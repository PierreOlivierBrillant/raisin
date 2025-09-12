import React from "react";

export const LegendPalette: React.FC = () => (
  <div
    style={{
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(4px)",
      border: "1px solid #e5e7eb",
      borderRadius: ".5rem",
      padding: ".4rem .55rem",
      display: "flex",
      gap: ".9rem",
      alignItems: "center",
      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
      fontSize: ".65rem",
      color: "#374151",
    }}
  >
    {[
      { c: "#EF4444", label: "Racine", ring: "#7F1D1D" },
      { c: "#3B82F6", label: "Dossiers", ring: "#1D4ED8" },
      { c: "#10B981", label: "Fichiers", ring: "#047857" },
    ].map((item) => (
      <span
        key={item.label}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: item.c,
            boxShadow: `0 0 0 2px ${item.ring} inset`,
          }}
        />
        <span>{item.label}</span>
      </span>
    ))}
  </div>
);
