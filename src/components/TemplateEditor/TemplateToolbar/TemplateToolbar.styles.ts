export const templateToolbarStyles = {
  container: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    marginBottom: "0.5rem",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  fileLabel: {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
  } as React.CSSProperties,
  presetButton: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  } as React.CSSProperties,
  presetLogo: {
    width: 14,
    height: 14,
    display: "block",
  } as React.CSSProperties,
};
