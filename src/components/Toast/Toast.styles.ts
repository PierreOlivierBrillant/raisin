import type { CSSProperties } from "react";

export const toastStyles = {
  container: {
    position: "fixed" as const,
    right: "1.25rem",
    top: "1.25rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: ".5rem",
    zIndex: 2000,
    maxWidth: "min(320px, calc(100vw - 2.5rem))",
    pointerEvents: "none" as const,
  },
  toast: (tone: "info" | "success" | "error"): CSSProperties => {
    const palette: Record<
      "info" | "success" | "error",
      { bg: string; border: string; color: string }
    > = {
      info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
      success: { bg: "#ecfdf5", border: "#6ee7b7", color: "#047857" },
      error: { bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" },
    };
    const { bg, border, color } = palette[tone];
    return {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ".75rem",
      borderRadius: ".65rem",
      border: `1px solid ${border}`,
      background: bg,
      color,
      padding: ".65rem .85rem",
      boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)",
      fontSize: ".85rem",
      pointerEvents: "auto" as const,
    };
  },
  dismissButton: {
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: "1rem",
    lineHeight: 1,
    padding: 0,
  },
};
