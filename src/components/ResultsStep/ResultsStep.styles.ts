export const resultsStyles = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap" as const,
  },
  studentList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  studentCard: {
    border: "1px solid #e5e7eb",
    borderRadius: ".5rem",
    padding: "1rem",
  },
  studentCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    margin: "0 0 .75rem",
  },
  matchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: ".75rem",
  },
  matchItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: ".65rem .7rem",
    background: "#f9fafb",
    borderRadius: ".5rem",
  },
  matchTitle: {
    fontWeight: 500,
    fontSize: ".8rem",
    margin: "0 0 .15rem",
  },
  matchPath: {
    fontSize: ".7rem",
    color: "#6b7280",
    margin: 0,
  },
  matchStatus: {
    display: "flex",
    alignItems: "center",
    gap: ".35rem",
    fontSize: ".75rem",
  },
};
