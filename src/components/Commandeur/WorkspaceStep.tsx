import React, { useEffect, useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { FolderOpen } from "lucide-react";
import { commandeurStyles } from "./Commandeur.styles";
import type { CommandeurWorkspaceSummary } from "../../types";
import { prepareCommandeurWorkspace } from "../../services/commandeur/api";
import Modal from "../Modal/Modal";

interface WorkspaceStepProps {
  workspace: CommandeurWorkspaceSummary | null;
  onWorkspaceReady: (summary: CommandeurWorkspaceSummary) => void;
  workspaceConfirmed: boolean;
  onConfirm: () => void;
  onReset: () => void;
}

export const WorkspaceStep: React.FC<WorkspaceStepProps> = ({
  workspace,
  onWorkspaceReady,
  workspaceConfirmed,
  onConfirm,
  onReset,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubfoldersDialog, setShowSubfoldersDialog] = useState(false);

  useEffect(() => {
    setShowSubfoldersDialog(false);
  }, [workspace?.workspaceId]);

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
      </div>

      {!workspace && (
        <div style={commandeurStyles.workspaceSelector.zone}>
          <FolderOpen size={48} color="#9ca3af" />
          <p style={commandeurStyles.workspaceSelector.hint}>
            Sélectionnez le dossier racine qui contient les dossiers étudiants.
          </p>
          <div style={commandeurStyles.workspaceSelector.actions}>
            <button
              className="btn btn-primary"
              onClick={() => selectWorkspace()}
              disabled={isLoading}
            >
              {isLoading ? "Préparation..." : "Choisir un dossier"}
            </button>
          </div>
          {isLoading && (
            <div style={commandeurStyles.workspaceSelector.status}>
              Préparation du workspace...
            </div>
          )}
          {error && (
            <p style={commandeurStyles.workspaceSelector.error}>
              Erreur : {error}
            </p>
          )}
        </div>
      )}

      {workspace && (
        <section style={commandeurStyles.workspaceSummary.card}>
          <div style={commandeurStyles.workspaceSummary.headerRow}>
            <div style={commandeurStyles.workspaceSummary.controlGroup}>
              <button
                className="btn"
                onClick={() => selectWorkspace()}
                disabled={isLoading}
              >
                Changer de dossier
              </button>
              <button className="btn" onClick={onReset} disabled={isLoading}>
                Réinitialiser
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowSubfoldersDialog(true)}
                disabled={!workspace.subFolders.length}
                title="Voir les sous-dossiers détectés"
              >
                Sous-dossiers ({workspace.subFolders.length})
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={workspaceConfirmed || isLoading}
            >
              {workspaceConfirmed ? "Workspace confirmé" : "Prochaine étape"}
            </button>
          </div>
          {workspace.extractedPath && (
            <p style={commandeurStyles.workspaceSummary.extracted}>
              Archive extraite : {workspace.extractedPath}
            </p>
          )}
          {isLoading && (
            <div style={commandeurStyles.workspaceSelector.status}>
              Préparation du workspace...
            </div>
          )}
          {error && (
            <p style={commandeurStyles.workspaceSelector.error}>
              Erreur : {error}
            </p>
          )}
          {workspaceConfirmed && (
            <div style={commandeurStyles.badgeRow}>
              <span style={commandeurStyles.badge("success")}>
                Workspace prêt pour l'étape suivante.
              </span>
            </div>
          )}
        </section>
      )}

      {showSubfoldersDialog && workspace && (
        <Modal
          onClose={() => setShowSubfoldersDialog(false)}
          ariaLabel="Sous-dossiers détectés"
          padding="1.5rem"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                Sous-dossiers détectés ({workspace.subFolders.length})
              </h3>
              <p
                style={{
                  margin: ".35rem 0 0",
                  color: "#4b5563",
                  fontSize: ".85rem",
                }}
              >
                Aperçu du dossier sélectionné et de son contenu.
              </p>
            </div>
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
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowSubfoldersDialog(false)}
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WorkspaceStep;
