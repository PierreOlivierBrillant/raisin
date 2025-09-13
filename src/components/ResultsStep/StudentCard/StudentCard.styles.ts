export const studentCardStyles = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: ".5rem",
    padding: ".6rem .75rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    margin: "0 0 .4rem",
  },
  title: {
    margin: 0,
    fontSize: ".8rem",
  },
  empty: {
    fontSize: ".6rem",
    margin: ".4rem 0 0",
  },
} as const;
