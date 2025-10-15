export const paramsStyles = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  formRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: ".35rem",
  },
  inlineFields: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "1rem",
  },
  input: {
    padding: ".6rem .7rem",
    border: "1px solid #d1d5db",
    borderRadius: ".375rem",
    fontSize: ".9rem",
    flex: 1,
    minWidth: "220px",
  },
  label: {
    fontSize: ".8rem",
    fontWeight: 500,
  },
  hint: {
    fontSize: ".65rem",
    color: "#6b7280",
  },
  actionsRow: {
    display: "flex",
    gap: ".75rem",
    flexWrap: "wrap" as const,
  },
  rootTabs: {
    display: "flex",
    gap: ".4rem",
    flexWrap: "wrap" as const,
    marginBottom: ".5rem",
  },
  overlay: {
    position: "absolute" as const,
    inset: 0,
    background: "rgba(255,255,255,0.65)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    fontSize: ".7rem",
    gap: ".5rem",
  },
  spinner: {
    width: 28,
    height: 28,
    border: "3px solid #d1d5db",
    borderTopColor: "#2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
