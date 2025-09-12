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
};
