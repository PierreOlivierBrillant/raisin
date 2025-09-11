export const teStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "3fr 1fr",
    gap: "1rem",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  sidePanelSlot: {
    position: "relative",
    display: "flex",
    alignItems: "stretch",
  },
  sidePanelAnimator: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
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
    fontSize: ".75rem",
    color: "#6b7280",
  },
  smallGraph: {
    height: "400px",
  },
} as const;
