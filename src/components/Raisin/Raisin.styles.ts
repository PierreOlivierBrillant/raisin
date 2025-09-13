export const raisinStyles = {
  main: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  verticalStack: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
    width: "100%",
    maxWidth: 1400,
    margin: "0 auto",
  },
  templateCard: (height?: number) => ({
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    height: height ? `${height}px` : undefined,
    minHeight: 300,
  }),
  templateHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  h3: { margin: 0 },
} as const;
