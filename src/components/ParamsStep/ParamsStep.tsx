import React, { useState } from "react";
import type { HierarchyTemplate, StudentFolder } from "../../types";
import { analyzeZipStructureMock } from "../../services/analyzeZip";
import { ZipFolderPicker } from "../ZipFolderPicker/ZipFolderPicker";
import { paramsStyles } from "./ParamsStep.styles";

interface ParamsStepProps {
  template: HierarchyTemplate | null;
  zipFile: File | null;
  onAnalysisComplete: (results: StudentFolder[]) => void;
  onNext?: () => void;
  setIsProcessing: (p: boolean) => void;
  isProcessing: boolean;
}

export const ParamsStep: React.FC<ParamsStepProps> = ({
  template,
  zipFile,
  onAnalysisComplete,
  onNext,
  setIsProcessing,
  isProcessing,
}) => {
  const [studentRootPath, setStudentRootPath] = useState("");
  const [projectsPerStudent, setProjectsPerStudent] = useState(1);
  // Plus de modal : le sélecteur est inline directement

  const start = async () => {
    if (!zipFile || !template) return;
    if (projectsPerStudent <= 0) {
      alert("Le nombre de projets par étudiant doit être supérieur à 0.");
      return;
    }
    setIsProcessing(true);
    try {
      const results = await analyzeZipStructureMock({
        template,
        zipFile,
        studentRootPath,
        projectsPerStudent,
      });
      onAnalysisComplete(results);
      onNext?.();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="card" style={{ position: "relative" }}>
      <h3 style={{ margin: "0 0 .75rem", fontSize: "1rem" }}>
        Paramètres d'analyse
      </h3>
      <form
        style={paramsStyles.form}
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          <label style={{ fontSize: ".8rem", fontWeight: 500 }}>
            Dossier contenant les dossiers étudiants (sélectionnez dans
            l'arborescence)
          </label>
          {zipFile ? (
            <ZipFolderPicker
              zipFile={zipFile}
              inline
              onSelect={(folderPath) => setStudentRootPath(folderPath)}
            />
          ) : (
            <div style={{ fontSize: ".65rem", color: "#6b7280" }}>
              Téléversez un ZIP dans l'étape précédente pour explorer son
              contenu.
            </div>
          )}
        </div>
        <div style={paramsStyles.inlineFields}>
          <div style={{ ...paramsStyles.formRow, flex: 1 }}>
            <label style={{ fontSize: ".8rem", fontWeight: 500 }}>
              Nombre de projets par étudiant
            </label>
            <input
              type="number"
              min={1}
              value={projectsPerStudent}
              onChange={(e) => setProjectsPerStudent(Number(e.target.value))}
              style={paramsStyles.input}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isProcessing}
          >
            Lancer l'analyse
          </button>
        </div>
      </form>
      {/* Le picker est affiché inline plus haut */}
      {isProcessing && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.65)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: ".7rem",
            gap: ".5rem",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid #d1d5db",
              borderTopColor: "#2563eb",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Analyse en cours…
        </div>
      )}
    </div>
  );
};
