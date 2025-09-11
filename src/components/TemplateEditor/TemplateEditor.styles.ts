// Styles spécifiques au composant TemplateEditor
// Centralisés ici pour retirer les règles du CSS global.
export const teStyles = {
  grid: {
    display: "grid",
    // 75% (visualiseur graph) / 25% (panneau actions)
    gridTemplateColumns: "3fr 1fr",
    gap: "1rem",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  graphWrapper: {
    border: "1px solid #e5e7eb",
    borderRadius: ".5rem",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    background: "#f8fafc",
  },
  graph: {
    width: "100%",
    flex: 1,
    height: "100%",
    display: "block",
  },
  legend: {
    marginTop: "1rem",
    fontSize: ".75rem",
    color: "#6b7280",
  },
  // Responsive override (sera appliqué via matchMedia dans le composant si besoin futur)
  smallGraph: {
    height: "400px",
  },
} as const;
