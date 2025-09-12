import React from "react";
import { AlertCircle, CheckCircle, Download } from "lucide-react";
import type { HierarchyTemplate, StudentFolder } from "../../types";
import { resultsStyles } from "./ResultsStep.styles";

interface ResultsStepProps {
  template: HierarchyTemplate | null;
  analysisResults: StudentFolder[];
  onGenerateStandardizedZip?: () => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  template,
  analysisResults,
  onGenerateStandardizedZip,
}) => {
  if (!analysisResults.length) return null;

  return (
    <div className="card">
      <div style={resultsStyles.headerRow}>
        <button onClick={onGenerateStandardizedZip} className="btn btn-success">
          <Download size={16} /> Générer ZIP standardisé
        </button>
      </div>
      <div style={resultsStyles.studentList}>
        {analysisResults.map((student, i) => (
          <div key={i} style={resultsStyles.studentCard}>
            <div style={resultsStyles.studentCardHeader}>
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
            <div style={resultsStyles.matchGrid}>
              {student.matches.map((match, mi) => (
                <div key={mi} style={resultsStyles.matchItem}>
                  <div>
                    <p style={resultsStyles.matchTitle}>
                      {template?.nodes[match.templateNodeId]?.name}
                    </p>
                    <p style={resultsStyles.matchPath}>
                      {match.foundPath || "Non trouvé"}
                    </p>
                  </div>
                  <div style={resultsStyles.matchStatus}>
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
  );
};
