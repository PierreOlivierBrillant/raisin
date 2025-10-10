export const commandeurStyles = {
  page: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem",
  },
  stepperRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: "1rem",
  },
  actionsRow: {
    display: "flex",
    gap: ".5rem",
    flexWrap: "wrap" as const,
  },
  card: {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  summaryList: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: ".75rem",
    padding: "1rem",
    maxHeight: "280px",
    overflow: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: ".35rem",
  },
  badgeRow: {
    display: "flex",
    gap: ".4rem",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  badge: (tone: "neutral" | "success" | "warning" | "error") => {
    const palette: Record<
      "neutral" | "success" | "warning" | "error",
      { bg: string; border: string; color: string }
    > = {
      neutral: { bg: "#f3f4f6", border: "#e5e7eb", color: "#1f2937" },
      success: { bg: "#dcfce7", border: "#86efac", color: "#065f46" },
      warning: { bg: "#fef3c7", border: "#fcd34d", color: "#92400e" },
      error: { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b" },
    };
    const { bg, border, color } = palette[tone];
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: ".4rem",
      borderRadius: "9999px",
      padding: ".15rem .55rem",
      fontSize: ".7rem",
      fontWeight: 600,
      background: bg,
      border: `1px solid ${border}`,
      color,
    } as const;
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: ".5rem",
    margin: 0,
    padding: 0,
    listStyle: "none" as const,
  },
  listItem: {
    border: "1px solid #e5e7eb",
    borderRadius: ".65rem",
    padding: ".75rem",
    background: "#fff",
    display: "flex",
    flexDirection: "column" as const,
    gap: ".35rem",
  },
  logList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: ".35rem",
    maxHeight: "320px",
    overflow: "auto" as const,
    paddingRight: 4,
  },
  logEntry: {
    borderLeft: "4px solid #2563eb",
    background: "#eff6ff",
    padding: ".35rem .5rem",
    borderRadius: ".4rem",
    fontSize: ".75rem",
  },
  emptyState: {
    border: "1px dashed #d1d5db",
    borderRadius: ".75rem",
    padding: "1rem",
    color: "#6b7280",
    background: "#f9fafb",
    textAlign: "center" as const,
  },
};
