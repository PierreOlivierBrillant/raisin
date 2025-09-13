export const modalStyles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  container: {
    background: "#fff",
    width: "min(640px,90%)",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column" as const,
    borderRadius: 8,
    boxShadow: "0 8px 28px -4px rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
} as const;
