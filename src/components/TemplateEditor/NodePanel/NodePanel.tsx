import React from "react";
import { nodePanelStyles } from "./NodePanel.styles";

interface NodePanelProps {
  selectedNode: string | null;
  rootId: string | null;
  selectedNodeHasChildren: boolean;
  nodeName: string;
  setNodeName: (v: string) => void;
  nodeType: "file" | "directory";
  setNodeType: (v: "file" | "directory") => void;
  childName: string;
  setChildName: (v: string) => void;
  childType: "file" | "directory";
  setChildType: (v: "file" | "directory") => void;
  addChildNode: () => void;
  deleteSelectedNode: () => void;
  canDeleteRoot?: boolean;
  deleteRoot?: () => void;
  nameError?: string | null;
}

export const NodePanel: React.FC<NodePanelProps> = ({
  selectedNode,
  rootId,
  selectedNodeHasChildren,
  nodeName,
  setNodeName,
  nodeType,
  setNodeType,
  childName,
  setChildName,
  childType,
  setChildType,
  addChildNode,
  deleteSelectedNode,
  canDeleteRoot,
  deleteRoot,
  nameError,
}) => {
  const isRoot = selectedNode !== null && rootId === selectedNode;
  const inputErrorStyle = nameError
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 1px rgba(220,38,38,0.2)" }
    : undefined;
  return (
    <div className="card">
      <div className="v-stack md">
        <div className="v-stack sm">
          <h4 style={nodePanelStyles.sectionTitle}>
            {selectedNode
              ? isRoot
                ? "Racine"
                : "Modifier / Gérer le nœud"
              : "Sélectionnez un nœud"}
          </h4>
          <div>
            <label className="form-label">Nom</label>
            <input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              className="input"
              placeholder={selectedNode ? "Nom du nœud" : "Nom"}
              disabled={!selectedNode}
              aria-invalid={Boolean(nameError)}
              style={inputErrorStyle}
            />
            {isRoot && (
              <p style={{ fontSize: 12, marginTop: 4, color: "#6b7280" }}>
                Le nom de la racine doit être unique.
              </p>
            )}
            {nameError && (
              <p style={{ fontSize: 12, marginTop: 4, color: "#dc2626" }}>
                {nameError}
              </p>
            )}
          </div>
          <div>
            <label className="form-label">Type</label>
            <select
              value={nodeType}
              onChange={(e) =>
                setNodeType(e.target.value as "file" | "directory")
              }
              className="select"
              disabled={!selectedNode || isRoot}
            >
              <option value="directory">Dossier</option>
              <option
                value="file"
                disabled={nodeType === "directory" && selectedNodeHasChildren}
              >
                Fichier
              </option>
            </select>
            {selectedNodeHasChildren && nodeType === "directory" && (
              <p style={{ fontSize: 12, marginTop: 4, color: "#B45309" }}>
                Impossible de convertir en fichier: ce dossier contient des
                enfants.
              </p>
            )}
          </div>
        </div>
        {selectedNode && (
          <>
            <div className="v-stack sm">
              <h4 style={nodePanelStyles.sectionTitle}>Ajouter un enfant</h4>
              <div>
                <label className="form-label">Nom enfant</label>
                <input
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="input"
                  placeholder="Nom de l'enfant"
                />
              </div>
              <div>
                <label className="form-label">Type enfant</label>
                <select
                  value={childType}
                  onChange={(e) =>
                    setChildType(e.target.value as "file" | "directory")
                  }
                  className="select"
                >
                  <option value="directory">Dossier</option>
                  <option value="file">Fichier</option>
                </select>
              </div>
              <button
                onClick={addChildNode}
                className="btn btn-success"
                disabled={!childName}
              >
                Ajouter enfant
              </button>
            </div>
            {!isRoot && (
              <div className="v-stack sm">
                <h4 style={nodePanelStyles.sectionTitle}>Danger</h4>
                <button onClick={deleteSelectedNode} className="btn btn-danger">
                  Supprimer le nœud
                </button>
              </div>
            )}
            {isRoot && canDeleteRoot && (
              <div className="v-stack sm">
                <h4 style={nodePanelStyles.sectionTitle}>Danger</h4>
                <button
                  onClick={deleteRoot}
                  className="btn btn-danger"
                  disabled={!deleteRoot}
                >
                  Supprimer la racine
                </button>
                <p style={{ fontSize: 12, marginTop: 4, color: "#B45309" }}>
                  Toute l'arborescence sous cette racine sera supprimée.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
