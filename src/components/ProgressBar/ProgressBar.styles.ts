export const progressBarStyles = {
  outer: {
    width: "100%",
  },
  track: (height: number) => ({
    height,
    background: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden" as const,
  }),
  bar: {
    display: "block",
    height: "100%",
    background: "linear-gradient(90deg,#10b981,#059669)",
    transition: "width .25s ease",
  },
  percent: {
    fontSize: ".55rem",
    marginTop: 4,
    textAlign: "right" as const,
    fontVariantNumeric: "tabular-nums" as const,
    opacity: 0.7,
  },
} as const;
