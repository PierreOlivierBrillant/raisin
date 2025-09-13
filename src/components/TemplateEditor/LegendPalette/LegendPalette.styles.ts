export const legendPaletteStyles = {
  container: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(4px)",
    border: "1px solid #e5e7eb",
    borderRadius: ".5rem",
    padding: ".4rem .55rem",
    display: "flex",
    gap: ".9rem",
    alignItems: "center" as const,
    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
    fontSize: ".65rem",
    color: "#374151",
  },
  item: {
    display: "inline-flex",
    alignItems: "center" as const,
    gap: 4,
  },
  colorBox: (c: string, ring: string) => ({
    width: 12,
    height: 12,
    borderRadius: 3,
    background: c,
    boxShadow: `0 0 0 2px ${ring} inset`,
  }),
} as const;
