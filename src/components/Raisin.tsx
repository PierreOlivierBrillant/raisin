import React, { useState } from "react";
import { Settings, Upload } from "lucide-react";
import { ZipProcessor } from "./ZipProcessor/ZipProcessor";
import type { HierarchyTemplate } from "../types/HierarchyTemplate";
import type { StudentFolder } from "../types/StudentFolder";
import "../styles/layout.css";
import { TemplateEditor } from "./TemplateEditor/TemplateEditor";

export const Raisin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"template" | "process">(
    "template"
  );
  const [currentTemplate, setCurrentTemplate] =
    useState<HierarchyTemplate | null>(null);
  // onZipUpload conservé pour extension future, mais pas de stockage local nécessaire actuellement
  const setUploadedZip = () => {
    /* noop placeholder */
  };
  const [analysisResults, setAnalysisResults] = useState<StudentFolder[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Raisin 🍇</h1>
        <h2>Standardisateur de Dossiers ZIP</h2>
      </header>
      <nav className="tabs">
        <button
          className={`tab ${activeTab === "template" ? "active" : ""}`}
          onClick={() => setActiveTab("template")}
        >
          <Settings size={18} /> Configuration du modèle
        </button>
        <button
          className={`tab ${activeTab === "process" ? "active" : ""}`}
          onClick={() => setActiveTab("process")}
        >
          <Upload size={18} /> Traitement du ZIP
        </button>
      </nav>
      <main className="main-content">
        {activeTab === "template" ? (
          <TemplateEditor
            template={currentTemplate}
            onTemplateChange={setCurrentTemplate}
          />
        ) : (
          <ZipProcessor
            template={currentTemplate}
            onZipUpload={setUploadedZip}
            analysisResults={analysisResults}
            onAnalysisComplete={setAnalysisResults}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
        )}
      </main>
    </div>
  );
};

export default Raisin;
