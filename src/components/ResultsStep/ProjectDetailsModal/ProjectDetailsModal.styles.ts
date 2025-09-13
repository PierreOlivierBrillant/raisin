export const projectDetailsModalStyles = {
  header: {
    padding: ".7rem .85rem",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  headerInfo: {
    display: "flex",
    flexDirection: "column" as const,
  },
  studentName: {
    fontSize: ".75rem",
  },
  projectPath: {
    fontSize: ".55rem",
    color: "#6b7280",
    wordBreak: "break-all" as const,
  },
  closeButton: {
    fontSize: ".6rem",
    padding: ".3rem .55rem",
  },
  body: {
    padding: ".65rem .75rem 1rem",
    overflow: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: ".55rem",
    fontSize: ".6rem",
  },
  scoreRow: {
    display: "flex",
    gap: ".6rem",
    flexWrap: "wrap" as const,
    alignItems: "center" as const,
  },
  modifiedBadge: {
    background: "#fef3c7",
    border: "1px solid #fcd34d",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: ".55rem",
  },
  matchesGrid: {
    display: "grid",
    gap: ".35rem",
    maxHeight: "45vh",
    overflow: "auto" as const,
    paddingRight: 4,
  },
  match: {
    display: "flex",
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    background: "#f9fafb",
    padding: ".25rem .4rem",
    borderRadius: 4,
    border: "1px solid #f3f4f6",
  },
  matchPath: {
    fontSize: ".55rem",
  },
  matchStatus: {
    fontSize: ".55rem",
    display: "flex",
    alignItems: "center" as const,
    gap: 4,
  },
} as const;
