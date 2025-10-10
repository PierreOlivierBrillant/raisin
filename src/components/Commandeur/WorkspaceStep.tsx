import React, { useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { commandeurStyles } from "./Commandeur.styles";
import type { CommandeurWorkspaceSummary } from "../../types";
import { prepareCommandeurWorkspace } from "../../services/commandeur/api";

interface WorkspaceStepProps {
  workspace: CommandeurWorkspaceSummary | null;
  onWorkspaceReady: (summary: CommandeurWorkspaceSummary) => void;
  onReset: () => void;
}

export const WorkspaceStep: React.FC<WorkspaceStepProps> = ({
  workspace,
  onWorkspaceReady,
  onReset,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectWorkspace = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;
      if (!isDesktop) {
        throw new Error(
          "La sélection de fichiers est disponible uniquement dans l'application desktop."
        );
      }
      const selection = await open({
        multiple: false,
        directory: true,
      });
      if (!selection || Array.isArray(selection)) return;
      const summary = await prepareCommandeurWorkspace(selection);
      onWorkspaceReady(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card" style={commandeurStyles.card}>
      <div style={commandeurStyles.stepperRow}>
        <div>
          <h3 style={{ margin: 0 }}>1. Préparer l'espace de travail</h3>
          <p
            style={{
              margin: ".35rem 0 0",
              color: "#4b5563",
              fontSize: ".85rem",
            }}
          >
            Choisissez un dossier contenant les sous-dossiers étudiants.
          </p>
        </div>
        {workspace && (
          <div style={commandeurStyles.actionsRow}>
            <button className="btn" onClick={onReset} disabled={isLoading}>
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      <div
        style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" as const }}
      >
        <button
          className="btn btn-primary"
          onClick={() => selectWorkspace()}
          disabled={isLoading}
        >
          Choisir un dossier…
        </button>
      </div>

      {error && (
        <div style={commandeurStyles.badge("error")}>Erreur : {error}</div>
      )}

      {isLoading && (
        <div style={commandeurStyles.badge("neutral")}>Chargement…</div>
      )}

      {workspace ? (
        <section>
          <div style={commandeurStyles.badgeRow}>
            <span style={commandeurStyles.badge("success")}>
              Mode : {workspace.mode === "zip" ? "Archive" : "Dossier"}
            </span>
            <span style={commandeurStyles.badge("neutral")}>
              ID : {workspace.workspaceId}
            </span>
            <span style={commandeurStyles.badge("neutral")}>
              Sous-dossiers : {workspace.subFolders.length}
            </span>
          </div>
          <div style={{ marginTop: ".85rem" }}>
            <h4 style={{ margin: "0 0 .35rem" }}>Chemins</h4>
            <ul style={commandeurStyles.list}>
              <li style={commandeurStyles.listItem}>
                <strong>Source :</strong> {workspace.sourcePath}
              </li>
              {workspace.extractedPath && (
                <li style={commandeurStyles.listItem}>
                  <strong>Extraction :</strong> {workspace.extractedPath}
                </li>
              )}
            </ul>
          </div>
          <div style={{ marginTop: ".75rem" }}>
            <h4 style={{ margin: "0 0 .35rem" }}>Sous-dossiers détectés</h4>
            {workspace.subFolders.length ? (
              <div style={commandeurStyles.summaryList}>
                {workspace.subFolders.map((folderName) => (
                  <div
                    key={folderName}
                    style={{ fontSize: ".8rem", color: "#1f2937" }}
                  >
                    {folderName}
                  </div>
                ))}
              </div>
            ) : (
              <div style={commandeurStyles.emptyState}>
                Aucun sous-dossier trouvé.
              </div>
            )}
          </div>
        </section>
      ) : (
        <div style={commandeurStyles.emptyState}>
          Aucun workspace chargé. Sélectionnez un dossier pour commencer.
        </div>
      )}
    </div>
  );
};

export default WorkspaceStep;
