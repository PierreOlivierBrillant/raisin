import React from "react";
import { toastStyles } from "./Toast.styles";

export type ToastTone = "info" | "success" | "error";

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div style={toastStyles.container} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} style={toastStyles.toast(toast.tone)}>
          <span>{toast.message}</span>
          <button
            type="button"
            style={toastStyles.dismissButton}
            onClick={() => onDismiss(toast.id)}
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
