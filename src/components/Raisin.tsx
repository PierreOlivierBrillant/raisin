import React, { useState, useEffect, useRef } from "react";
import { ZipUploadStep } from "./ZipUploadStep/ZipUploadStep";
import { ParamsStep } from "./ParamsStep/ParamsStep";
import { ResultsStep } from "./ResultsStep/ResultsStep";
import { TemplateEditor } from "./TemplateEditor/TemplateEditor";
import { Stepper } from "./Stepper/Stepper";
import type { HierarchyTemplate, StudentFolder } from "../types";
import "../styles/layout.css";

export const Raisin: React.FC = () => {
  const [currentTemplate, setCurrentTemplate] =
    useState<HierarchyTemplate | null>(null);
  // Stocke le ZIP fourni par l'utilisateur pour contrôler l'accès à l'étape Paramètres
  const [uploadedZip, setUploadedZip] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<StudentFolder[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3>(0);
  const templateCardRef = useRef<HTMLDivElement | null>(null);
  const [templateAreaHeight, setTemplateAreaHeight] = useState<
    number | undefined
  >(undefined);

  // Un modèle est considéré valide si la racine possède au moins un enfant
  const isTemplateValid = React.useMemo(() => {
    if (!currentTemplate) return false;
    const rootId = currentTemplate.rootNodes[0];
    if (!rootId) return false;
    const rootNode = currentTemplate.nodes[rootId];
    if (!rootNode) return false;
    return rootNode.children.length > 0; // au moins un enfant direct
  }, [currentTemplate]);

  const steps = [
    { id: 0, label: "Modèle" },
    // Étape ZIP désactivée tant que le modèle n'a pas au moins un enfant sous la racine
    { id: 1, label: "ZIP", disabled: !isTemplateValid },
    // Étape 2 bloquée tant qu'aucun zip valide n'est fourni (et modèle valide par transitivité car sinon on ne peut atteindre l'étape 1)
    { id: 2, label: "Paramètres", disabled: !uploadedZip },
    { id: 3, label: "Résultats", disabled: analysisResults.length === 0 },
  ];

  const goTo = (id: number | string) => {
    const step = Number(id) as 0 | 1 | 2 | 3;
    // Validation
    if (step === 1 && !isTemplateValid) return; // besoin d'un modèle valide
    if (step === 2 && !uploadedZip) return; // zip requis
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
                if (!file.name.toLowerCase().endsWith(".zip")) {
                  alert("Fichier invalide : une archive .zip est requise");
                  return;
                }
                setUploadedZip(file);
              }}
              onNext={() => goTo(2)}
            />
          )}
          {currentStep === 2 && (
            <ParamsStep
              template={currentTemplate}
              zipFile={uploadedZip}
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
              onGenerateStandardizedZip={() => {
                alert("Génération du ZIP standardisé - À implémenter");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Raisin;
