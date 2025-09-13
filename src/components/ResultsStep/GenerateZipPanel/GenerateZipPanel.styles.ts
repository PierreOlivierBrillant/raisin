export const generateZipPanelStyles = {
  column: {
    display: "flex",
    flexDirection: "column" as const,
    gap: ".6rem",
    marginBottom: "1.25rem",
    flexGrow: 1,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    textAlign: "center" as const,
    width: "100%",
  },
  cancelButton: {
    display: "inline-flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    textAlign: "center" as const,
    width: "100%",
  },
  spinner: {
    width: 14,
    height: 14,
    border: "2px solid #fff",
    borderTopColor: "transparent",
    borderRadius: "50%",
    display: "inline-block",
    marginRight: 6,
    animation: "spin 0.8s linear infinite",
  },
  progressWrapper: {
    width: "100%",
    marginTop: ".75rem",
  },
  progressLabel: {
    fontSize: ".55rem",
    marginBottom: 2,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    color: "#374151",
  },
} as const;
