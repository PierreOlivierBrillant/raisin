import React, { useState, useEffect, useRef } from "react";
import { ZipProcessor } from "./ZipProcessor/ZipProcessor";
import { TemplateEditor } from "./TemplateEditor/TemplateEditor";
import { Stepper } from "./Stepper/Stepper";
import type { HierarchyTemplate, StudentFolder } from "../types";
import "../styles/layout.css";

export const Raisin: React.FC = () => {
  const [currentTemplate, setCurrentTemplate] =
    useState<HierarchyTemplate | null>(null);
  // onZipUpload conservé pour extension future, mais pas de stockage local nécessaire actuellement
  const setUploadedZip = () => {
    /* noop placeholder */
  };
  const [analysisResults, setAnalysisResults] = useState<StudentFolder[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3>(0);
  const templateCardRef = useRef<HTMLDivElement | null>(null);
  const [templateAreaHeight, setTemplateAreaHeight] = useState<
    number | undefined
  >(undefined);

  const steps = [
    { id: 0, label: "Modèle" },
    { id: 1, label: "ZIP", disabled: !currentTemplate },
    { id: 2, label: "Paramètres", disabled: !currentTemplate },
    { id: 3, label: "Résultats", disabled: analysisResults.length === 0 },
  ];

  const goTo = (id: number | string) => {
    const step = Number(id) as 0 | 1 | 2 | 3;
    // Validation
    if (step === 1 && !currentTemplate) return;
    if (step === 2 && !currentTemplate) return;
    if (step === 3 && analysisResults.length === 0) return;
    setCurrentStep(step);
  };

  // Désactive le scroll vertical quand on est sur l'étape 0 (éditeur plein écran vertical)
  useEffect(() => {
    if (currentStep === 0) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [currentStep]);

  // Calcule la hauteur disponible pour l'éditeur (vue full-height sans scroll interne)
  useEffect(() => {
    if (currentStep !== 0) return;
    const compute = () => {
      if (!templateCardRef.current) return;
      const rect = templateCardRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      // On retire un petit buffer pour éviter un scroll (< 1px) + padding bas main-content (32px) + marge éventuelle
      const bottomPadding = 40; // ajustable
      const h = vh - rect.top - bottomPadding;
      setTemplateAreaHeight(h > 300 ? h : 300);
    };
    compute();
    window.addEventListener("resize", compute);
    const ro = new ResizeObserver(compute);
    if (templateCardRef.current) ro.observe(templateCardRef.current);
    return () => {
      window.removeEventListener("resize", compute);
      ro.disconnect();
    };
  }, [currentStep]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Raisin 🍇</h1>
        <h2>Standardisateur de dossiers ZIP</h2>
      </header>
      <main
        className="main-content"
        style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            flex: 1,
            minHeight: 0,
          }}
        >
          <Stepper steps={steps} current={currentStep} onChange={goTo} />
          {currentStep === 0 && (
            <div
              className="card"
              style={{
                padding: "1rem",
                marginBottom: 0,
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                height: templateAreaHeight ? templateAreaHeight : undefined,
                overflow: "hidden",
              }}
              ref={templateCardRef}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                  marginBottom: "1rem",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1rem" }}>
                  Configuration du modèle
                </h3>
                {currentTemplate && (
                  <button className="btn btn-primary" onClick={() => goTo(1)}>
                    Étape suivante
                  </button>
                )}
              </div>
              <TemplateEditor
                template={currentTemplate}
                onTemplateChange={setCurrentTemplate}
                forcedHeight={templateAreaHeight}
              />
            </div>
          )}
          {currentStep === 1 && (
            <ZipProcessor
              template={currentTemplate}
              onZipUpload={setUploadedZip}
              analysisResults={analysisResults}
              onAnalysisComplete={setAnalysisResults}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              mode="upload"
              onRequestStepChange={(m) => {
                if (m === "params") setCurrentStep(2);
              }}
            />
          )}
          {currentStep === 2 && (
            <ZipProcessor
              template={currentTemplate}
              onZipUpload={setUploadedZip}
              analysisResults={analysisResults}
              onAnalysisComplete={setAnalysisResults}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              mode="params"
              onRequestStepChange={(m) => {
                if (m === "results") setCurrentStep(3);
              }}
            />
          )}
          {currentStep === 3 && (
            <ZipProcessor
              template={currentTemplate}
              onZipUpload={setUploadedZip}
              analysisResults={analysisResults}
              onAnalysisComplete={setAnalysisResults}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              mode="results"
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Raisin;
