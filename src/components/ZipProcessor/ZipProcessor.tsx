import React, { useRef } from "react";
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
}

export const ZipProcessor: React.FC<ZipProcessorProps> = ({
  template,
  onZipUpload,
  analysisResults,
  onAnalysisComplete,
  isProcessing,
  setIsProcessing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onZipUpload(file);
    setIsProcessing(true);
    try {
      const results = await analyzeZipStructure();
      onAnalysisComplete(results);
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

  if (!template) {
    return (
      <div style={zpStyles.emptyState}>
        <AlertCircle size={48} color="#f59e0b" />
        <p>Veuillez d'abord configurer un modèle de hiérarchie.</p>
      </div>
    );
  }

  return (
    <div style={zpStyles.root}>
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
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary"
            disabled={isProcessing}
          >
            {isProcessing ? "Traitement..." : "Sélectionner un fichier"}
          </button>
        </div>
      </div>

      {analysisResults.length > 0 && (
        <div className="card">
          <div style={zpStyles.headerRow}>
            {/* Titre retiré car non utilisé visuellement */}
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
                          {template.nodes[match.templateNodeId]?.name}
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

      {isProcessing && (
        <div style={zpStyles.processingState}>
          <div style={zpStyles.spinner} />
          <p>Analyse du fichier ZIP en cours...</p>
        </div>
      )}
    </div>
  );
};
