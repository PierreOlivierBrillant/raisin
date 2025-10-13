import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    console.error("Global error", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled rejection", event.reason);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
