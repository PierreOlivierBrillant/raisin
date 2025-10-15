import React, { useState, useEffect, useRef } from "react";
import { ZipUploadStep } from "../ZipUploadStep/ZipUploadStep";
import { ParamsStep } from "../ParamsStep/ParamsStep";
import { ResultsStep } from "../ResultsStep/ResultsStep";
import { TemplateEditor } from "../TemplateEditor/TemplateEditor";
import { Stepper } from "../Stepper/Stepper";
import type { HierarchyTemplate, RootAnalysisResult } from "../../types";
import "../../styles/layout.css";
import { useStepperState } from "../../hooks/useStepperState";
import { raisinStyles } from "./Raisin.styles";
import type { ZipSource } from "../../types/zip";

interface RaisinProps {
  onBack?: () => void;
}

export const Raisin: React.FC<RaisinProps> = ({ onBack }) => {
  const [currentTemplate, setCurrentTemplate] =
    useState<HierarchyTemplate | null>(null);
  const [uploadedZip, setUploadedZip] = useState<ZipSource | null>(null);
  const [analysisResults, setAnalysisResults] = useState<RootAnalysisResult[]>(
    []
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const { current: currentStep, goTo: internalGoTo } = useStepperState<
    0 | 1 | 2 | 3
  >(0);
  const wasProcessingRef = useRef(false);
  const templateCardRef = useRef<HTMLDivElement | null>(null);
  const [templateAreaHeight, setTemplateAreaHeight] = useState<
    number | undefined
  >(undefined);

  const isTemplateValid = React.useMemo(() => {
    if (!currentTemplate) return false;
    const rootId = currentTemplate.rootNodes[0];
    if (!rootId) return false;
    const rootNode = currentTemplate.nodes[rootId];
    if (!rootNode) return false;
    return rootNode.children.length > 0;
  }, [currentTemplate]);

  const steps = [
    { id: 0, label: "Modèle" },
    { id: 1, label: "ZIP", disabled: !isTemplateValid },
    { id: 2, label: "Paramètres", disabled: !uploadedZip },
    { id: 3, label: "Résultats", disabled: analysisResults.length === 0 },
  ];

  const goTo = (id: number | string) => {
    const step = Number(id) as 0 | 1 | 2 | 3;
    if (step === 1 && !isTemplateValid) return;
    if (step === 2 && !uploadedZip) return;
    if (step === 3 && analysisResults.length === 0) return;
    internalGoTo(step);
  };

  useEffect(() => {
    if (wasProcessingRef.current && !isProcessing) {
      if (currentStep === 2 && analysisResults.length > 0) {
        internalGoTo(3);
      }
    }
    wasProcessingRef.current = isProcessing;
  }, [isProcessing, analysisResults.length, currentStep, internalGoTo]);

  useEffect(() => {
    if (currentStep === 0) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 0) return;
    const compute = () => {
      if (!templateCardRef.current) return;
      const rect = templateCardRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const bottomPadding = 40;
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
      <header className="app-header" style={{ position: "relative" }}>
        {onBack && (
          <div style={{ position: "absolute", left: 16, top: 12 }}>
            <button className="btn" onClick={onBack}>
              &larr; Accueil
            </button>
          </div>
        )}
        <h1>Raisin 🍇</h1>
        <h2>Standardisateur de dossiers ZIP</h2>
      </header>
      <main className="main-content" style={raisinStyles.main}>
        <div style={raisinStyles.verticalStack}>
          <Stepper steps={steps} current={currentStep} onChange={goTo} />
          {currentStep === 0 && (
            <div
              className="card"
              style={raisinStyles.templateCard(templateAreaHeight)}
              ref={templateCardRef}
            >
              <div style={raisinStyles.templateHeaderRow}>
                <h3 style={raisinStyles.h3}>Configuration du modèle</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => goTo(1)}
                  disabled={!isTemplateValid}
                  title={
                    !isTemplateValid
                      ? "Ajoutez au moins un nœud enfant à la racine pour continuer"
                      : undefined
                  }
                >
                  Étape suivante
                </button>
              </div>
              <TemplateEditor
                template={currentTemplate}
                onTemplateChange={setCurrentTemplate}
                forcedHeight={templateAreaHeight}
              />
            </div>
          )}
          {currentStep === 1 && (
            <ZipUploadStep
              template={currentTemplate}
              onZipChosen={(file) => {
                setUploadedZip(file);
                setAnalysisResults([]);
              }}
              onNext={() => goTo(2)}
            />
          )}
          {currentStep === 2 && (
            <ParamsStep
              template={currentTemplate}
              zipSource={uploadedZip}
              onAnalysisComplete={setAnalysisResults}
              onNext={() => goTo(3)}
              setIsProcessing={setIsProcessing}
              isProcessing={isProcessing}
            />
          )}
          {currentStep === 3 && (
            <ResultsStep
              template={currentTemplate}
              analysisResults={analysisResults}
              zipSource={uploadedZip!}
              onResultsChange={(upd) => setAnalysisResults(upd)}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Raisin;
