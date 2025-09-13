export const zipFolderPickerExtraStyles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: ".5rem",
    flex: 1,
  },
  loading: {
    fontSize: ".7rem",
  },
  error: {
    fontSize: ".7rem",
    color: "#b91c1c",
  },
  focusableScroll: (hasFocus: boolean) => ({
    outline: hasFocus ? "2px solid #2563eb" : "none",
    outlineOffset: 2,
  }),
} as const;
