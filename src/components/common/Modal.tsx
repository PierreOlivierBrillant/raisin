import React from "react";

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Largeur maximale (CSS width). */
  width?: string;
  /** Hauteur maximale. */
  maxHeight?: string;
  /** Libellé ARIA du dialogue. */
  ariaLabel?: string;
}

/** Conteneur modal générique centré avec overlay. */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  children,
  width = "min(640px,90%)",
  maxHeight = "80vh",
  ariaLabel,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          width,
          maxHeight,
          display: "flex",
          flexDirection: "column",
          borderRadius: 8,
          boxShadow: "0 8px 28px -4px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
