import React from "react";
import { modalStyles } from "./Modal.styles";

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
      style={{ ...modalStyles.overlay }}
      onClick={onClose}
    >
      <div
        style={{
          ...modalStyles.container,
          width,
          maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
