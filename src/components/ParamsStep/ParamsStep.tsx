import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom"; // Assure l'application immédiate de l'état avant navigation
import type { HierarchyTemplate, StudentFolder } from "../../types";
import { analyzeZipStructure } from "../../services/analyzeZip";
import { ZipFolderPicker } from "../ZipFolderPicker/ZipFolderPicker";
import { paramsStyles } from "./ParamsStep.styles";
import type { ZipSource } from "../../types/zip";

interface ParamsStepProps {
  template: HierarchyTemplate | null;
  zipSource: ZipSource | null;
  onAnalysisComplete: (results: StudentFolder[]) => void;
  onNext?: () => void;
  setIsProcessing: (p: boolean) => void;
  isProcessing: boolean;
}

export const ParamsStep: React.FC<ParamsStepProps> = ({
  template,
  zipSource,
  onAnalysisComplete,
  onNext,
  setIsProcessing,
  isProcessing,
}) => {
  const [studentRootPath, setStudentRootPath] = useState("");
  const [projectsPerStudent, setProjectsPerStudent] = useState(1);
  const [similarityThreshold, setSimilarityThreshold] = useState(90);
  // Plus de modal : le sélecteur est inline directement

  useEffect(() => {
    setStudentRootPath("");
  }, [zipSource]);

  const start = async () => {
    if (!zipSource || !template) return;
    if (projectsPerStudent <= 0) {
      alert("Le nombre de projets par étudiant doit être supérieur à 0.");
      return;
    }
    setIsProcessing(true);
    try {
      const results = await analyzeZipStructure({
        template,
        zipSource,
        studentRootPath,
        projectsPerStudent,
        similarityThreshold,
      });
      flushSync(() => {
        onAnalysisComplete(results);
      });
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
          <label style={paramsStyles.label}>
            Dossier contenant les dossiers étudiants (sélectionnez dans
            l'arborescence)
          </label>
          {zipSource ? (
            <ZipFolderPicker
              zipSource={zipSource}
              inline
              onSelect={(folderPath) => setStudentRootPath(folderPath)}
            />
          ) : (
            <div style={paramsStyles.hint}>
              Téléversez un ZIP dans l'étape précédente pour explorer son
              contenu.
            </div>
          )}
        </div>
        <div style={paramsStyles.inlineFields}>
          <div style={{ ...paramsStyles.formRow, flex: 1 }}>
            <label style={paramsStyles.label}>
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
          <div style={{ ...paramsStyles.formRow, flex: 1 }}>
            <label style={paramsStyles.label}>Seuil de similarité (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              style={paramsStyles.input}
            />
          </div>
        </div>
        <div style={paramsStyles.actionsRow}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isProcessing}
          >
            Lancer l'analyse
          </button>
        </div>
      </form>
      {isProcessing && (
        <div style={paramsStyles.overlay}>
          <div style={paramsStyles.spinner} />
          Analyse en cours…
        </div>
      )}
    </div>
  );
};
