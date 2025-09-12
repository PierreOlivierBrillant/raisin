import React, { useRef, useState } from "react";
import { AlertCircle, CheckCircle, Download, Upload } from "lucide-react";
import type { HierarchyTemplate, StudentFolder } from "../../types";
import { zpStyles } from "./ZipProcessor.styles";

interface ZipProcessorProps {
  template: HierarchyTemplate | null;
  onZipUpload: (file: File) => void;
  analysisResults: StudentFolder[];
  onAnalysisComplete: (results: StudentFolder[]) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  mode: "upload" | "params" | "results";
  onRequestStepChange?: (mode: "upload" | "params" | "results") => void;
}

export const ZipProcessor: React.FC<ZipProcessorProps> = ({
  template,
  onZipUpload,
  analysisResults,
  onAnalysisComplete,
  isProcessing,
  setIsProcessing,
  mode,
  onRequestStepChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [studentRootPath, setStudentRootPath] = useState<string>("");
  const [projectsPerStudent, setProjectsPerStudent] = useState<number>(1);

  const analyzeZipStructure = async (): Promise<StudentFolder[]> => {
    await new Promise((r) => setTimeout(r, 1500));
    return [
      {
        name: "Étudiant_1",
        overallScore: 98,
        matches: [
          {
            templateNodeId: "src",
            foundPath: "/Étudiant_1/projet/src",
            score: 100,
            status: "found",
          },
          {
            templateNodeId: "components",
            foundPath: "/Étudiant_1/projet/src/components",
            score: 100,
            status: "found",
          },
          {
            templateNodeId: "utils",
            foundPath: "/Étudiant_1/projet/src/utilities",
            score: 85,
            status: "found",
          },
        ],
      },
      {
        name: "Étudiant_2",
        overallScore: 92,
        matches: [
          {
            templateNodeId: "src",
            foundPath: "/Étudiant_2/source",
            score: 90,
            status: "found",
          },
          {
            templateNodeId: "components",
            foundPath: "/Étudiant_2/source/comp",
            score: 85,
            status: "found",
          },
          {
            templateNodeId: "utils",
            foundPath: "",
            score: 0,
            status: "missing",
          },
        ],
      },
    ];
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !template) return;
    setZipFile(file);
    onZipUpload(file);
    onRequestStepChange?.("params");
  };

  const startAnalysis = async () => {
    if (!zipFile || !template) return;
    if (!studentRootPath.trim()) {
      alert(
        "Veuillez indiquer le chemin du dossier contenant les dossiers d'étudiants dans l'archive."
      );
      return;
    }
    if (projectsPerStudent <= 0) {
      alert("Le nombre de projets par étudiant doit être supérieur à 0.");
      return;
    }
    setIsProcessing(true);
    try {
      // TODO: Passer studentRootPath & projectsPerStudent à la logique réelle d'analyse
      const results = await analyzeZipStructure();
      onAnalysisComplete(results);
      onRequestStepChange?.("results");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'analyse du fichier ZIP");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateStandardizedZip = () => {
    alert("Génération du ZIP standardisé - À implémenter");
  };

  return (
    <div style={zpStyles.root}>
      {mode === "upload" && (
        <div className="card">
          <div style={zpStyles.uploadZone}>
            <Upload size={48} color="#9ca3af" />
            <p style={zpStyles.uploadHint}>
              Glissez-déposez votre fichier ZIP ici ou cliquez pour sélectionner
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileUpload}
              hidden
            />
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
                disabled={isProcessing}
              >
                {zipFile
                  ? "Changer de fichier"
                  : isProcessing
                  ? "Traitement..."
                  : "Sélectionner un fichier"}
              </button>
              {zipFile && (
                <button
                  className="btn btn-secondary"
                  onClick={() => onRequestStepChange?.("params")}
                >
                  Étape suivante
                </button>
              )}
            </div>
            {zipFile && !isProcessing && (
              <p
                style={{
                  fontSize: ".75rem",
                  color: "#374151",
                  margin: "0.5rem 0 0",
                }}
              >
                Fichier sélectionné : <strong>{zipFile.name}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {mode === "params" && (
        <div className="card">
          <h3 style={{ margin: "0 0 .75rem", fontSize: "1rem" }}>
            Paramètres d'analyse
          </h3>
          <form
            className="config-form"
            style={zpStyles.configForm}
            onSubmit={(e) => {
              e.preventDefault();
              startAnalysis();
            }}
          >
            <div style={zpStyles.formRow}>
              <label style={{ fontSize: ".8rem", fontWeight: 500 }}>
                Chemin du dossier contenant les dossiers étudiants (dans
                l'archive)
              </label>
              <input
                type="text"
                placeholder="ex: export/submissions"
                value={studentRootPath}
                onChange={(e) => setStudentRootPath(e.target.value)}
                style={zpStyles.input}
              />
            </div>
            <div style={zpStyles.inlineFields}>
              <div style={{ ...zpStyles.formRow, flex: 1 }}>
                <label style={{ fontSize: ".8rem", fontWeight: 500 }}>
                  Nombre de projets par étudiant
                </label>
                <input
                  type="number"
                  min={1}
                  value={projectsPerStudent}
                  onChange={(e) =>
                    setProjectsPerStudent(Number(e.target.value))
                  }
                  style={zpStyles.input}
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
        </div>
      )}

      {mode === "results" && analysisResults.length > 0 && (
        <div className="card">
          <div style={zpStyles.headerRow}>
            <button
              onClick={generateStandardizedZip}
              className="btn btn-success"
            >
              <Download size={16} /> Générer ZIP standardisé
            </button>
          </div>
          <div style={zpStyles.studentList}>
            {analysisResults.map((student, i) => (
              <div key={i} style={zpStyles.studentCard}>
                <div style={zpStyles.studentCardHeader}>
                  <h3>{student.name}</h3>
                  <span
                    className={`badge ${
                      student.overallScore >= 95
                        ? "badge-success"
                        : student.overallScore >= 80
                        ? "badge-warning"
                        : "badge-error"
                    }`}
                  >
                    {student.overallScore}% de correspondance
                  </span>
                </div>
                <div style={zpStyles.matchGrid}>
                  {student.matches.map((match, mi) => (
                    <div key={mi} style={zpStyles.matchItem}>
                      <div>
                        <p style={zpStyles.matchTitle}>
                          {template?.nodes[match.templateNodeId]?.name}
                        </p>
                        <p style={zpStyles.matchPath}>
                          {match.foundPath || "Non trouvé"}
                        </p>
                      </div>
                      <div style={zpStyles.matchStatus}>
                        {match.status === "found" ? (
                          <CheckCircle size={20} color="#10b981" />
                        ) : (
                          <AlertCircle size={20} color="#ef4444" />
                        )}
                        <span>{match.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!template && mode !== "upload" && (
        <div style={zpStyles.emptyState}>
          <AlertCircle size={48} color="#f59e0b" />
          <p>Veuillez d'abord configurer un modèle de hiérarchie.</p>
        </div>
      )}

      {isProcessing && (
        <div style={zpStyles.processingState}>
          <div style={zpStyles.spinner} />
          <p>Analyse du fichier ZIP en cours...</p>
        </div>
      )}
    </div>
  );
};
