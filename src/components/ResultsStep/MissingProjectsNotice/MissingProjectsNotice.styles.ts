export const missingProjectsNoticeStyles = {
  container: {
    marginTop: ".25rem",
    fontSize: ".55rem",
    display: "flex",
    alignItems: "center" as const,
    gap: 4,
    color: "#92400e",
    background: "#fef3c7",
    padding: ".25rem .45rem",
    border: "1px solid #fcd34d",
    borderRadius: 4,
  },
  strong: {
    fontWeight: 600,
  } as React.CSSProperties,
} as const;
