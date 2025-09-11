import React from "react";
import { nodePanelStyles } from "./NodePanel.styles";

interface NodePanelProps {
  selectedNode: string | null;
  rootId: string | null;
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
}

export const NodePanel: React.FC<NodePanelProps> = ({
  selectedNode,
  rootId,
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
}) => {
  const isRoot = selectedNode !== null && rootId === selectedNode;
  return (
    <div className="card">
      <div className="v-stack md">
        <div className="v-stack sm">
          <h4 style={nodePanelStyles.sectionTitle}>
            {selectedNode
              ? isRoot
                ? "Nœud racine (verrouillé)"
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
              disabled={!selectedNode || isRoot}
            />
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
              <option value="file">Fichier</option>
            </select>
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
          </>
        )}
      </div>
    </div>
  );
};
