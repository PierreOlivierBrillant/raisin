import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom"; // Assure l'application immédiate de l'état avant navigation
import type { HierarchyTemplate, RootAnalysisResult } from "../../types";
import { analyzeZipStructure } from "../../services/analyzeZip";
import { ZipFolderPicker } from "../ZipFolderPicker/ZipFolderPicker";
import { paramsStyles } from "./ParamsStep.styles";
import type { ZipSource } from "../../types/zip";
import { extractTemplateForRoot } from "../TemplateEditor/TemplateEditor.logic";

interface ParamsStepProps {
  template: HierarchyTemplate | null;
  zipSource: ZipSource | null;
  onAnalysisComplete: (results: RootAnalysisResult[]) => void;
  onNext?: () => void;
  setIsProcessing: (p: boolean) => void;
  isProcessing: boolean;
}

interface RootSettings {
  studentRootPath: string;
  projectsPerStudent: number;
  similarityThreshold: number;
}

const DEFAULT_SETTINGS: RootSettings = {
  studentRootPath: "",
  projectsPerStudent: 1,
  similarityThreshold: 90,
};

export const ParamsStep: React.FC<ParamsStepProps> = ({
  template,
  zipSource,
  onAnalysisComplete,
  onNext,
  setIsProcessing,
  isProcessing,
}) => {
  const [settingsByRoot, setSettingsByRoot] = useState<
    Record<string, RootSettings>
  >({});
  const [activeRootId, setActiveRootId] = useState<string | null>(null);

  useEffect(() => {
    if (!template || template.rootNodes.length === 0) {
      setSettingsByRoot({});
      setActiveRootId(null);
      return;
    }
    setSettingsByRoot((prev) => {
      const next: Record<string, RootSettings> = {};
      template.rootNodes.forEach((rootId) => {
        next[rootId] = prev[rootId]
          ? { ...prev[rootId] }
          : { ...DEFAULT_SETTINGS };
      });
      return next;
    });
    if (!activeRootId || !template.rootNodes.includes(activeRootId)) {
      setActiveRootId(template.rootNodes[0]);
    }
  }, [template, activeRootId]);

  useEffect(() => {
    if (!zipSource) return;
    setSettingsByRoot((prev) => {
      const next: Record<string, RootSettings> = {};
      for (const [rootId, settings] of Object.entries(prev)) {
        next[rootId] = { ...settings, studentRootPath: "" };
      }
      return next;
    });
  }, [zipSource]);

  const updateSettings = (rootId: string, patch: Partial<RootSettings>) => {
    setSettingsByRoot((prev) => {
      const base = prev[rootId] ?? { ...DEFAULT_SETTINGS };
      return {
        ...prev,
        [rootId]: { ...base, ...patch },
      };
    });
  };

  const updateCurrentSettings = (patch: Partial<RootSettings>) => {
    if (!activeRootId) return;
    updateSettings(activeRootId, patch);
  };

  const roots = template?.rootNodes ?? [];
  const activeRootNode = activeRootId
    ? template?.nodes[activeRootId] ?? null
    : null;
  const currentSettings =
    activeRootId && settingsByRoot[activeRootId]
      ? settingsByRoot[activeRootId]
      : { ...DEFAULT_SETTINGS };

  const start = async () => {
    if (!zipSource || !template || roots.length === 0) return;

    for (const rootId of roots) {
      const settings = settingsByRoot[rootId] ?? { ...DEFAULT_SETTINGS };
      if (settings.projectsPerStudent <= 0) {
        const rootName = template.nodes[rootId]?.name ?? "Racine";
        alert(
          `Le nombre de projets par étudiant doit être supérieur à 0 pour la racine "${rootName}".`
        );
        return;
      }
    }

    setIsProcessing(true);
    try {
      const aggregated: RootAnalysisResult[] = [];
      for (const rootId of roots) {
        const subset = extractTemplateForRoot(template, rootId);
        if (!subset) continue;
        const settings = settingsByRoot[rootId] ?? { ...DEFAULT_SETTINGS };
        const folders = await analyzeZipStructure({
          template: subset,
          zipSource,
          studentRootPath: settings.studentRootPath,
          projectsPerStudent: settings.projectsPerStudent,
          similarityThreshold: settings.similarityThreshold,
        });
        aggregated.push({
          rootId,
          rootName: subset.nodes[rootId]?.name ?? "Racine",
          folders,
        });
      }
      flushSync(() => {
        onAnalysisComplete(aggregated);
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
      {roots.length > 1 && (
        <div style={paramsStyles.rootTabs}>
          {roots.map((rootId) => {
            const node = template?.nodes[rootId];
            if (!node) return null;
            const isActive = rootId === activeRootId;
            return (
              <button
                key={rootId}
                className={`btn btn-compact ${
                  isActive ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => setActiveRootId(rootId)}
              >
                {node.name}
              </button>
            );
          })}
        </div>
      )}
      <form
        style={paramsStyles.form}
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          <label style={paramsStyles.label}>
            Dossier contenant les dossiers étudiants pour{" "}
            <strong>{activeRootNode?.name ?? "Racine"}</strong>
          </label>
          {zipSource ? (
            <ZipFolderPicker
              zipSource={zipSource}
              inline
              selectedPath={currentSettings.studentRootPath}
              onSelect={(folderPath) =>
                updateCurrentSettings({ studentRootPath: folderPath })
              }
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
              value={currentSettings.projectsPerStudent}
              onChange={(e) =>
                updateCurrentSettings({
                  projectsPerStudent: Number(e.target.value),
                })
              }
              style={paramsStyles.input}
            />
          </div>
          <div style={{ ...paramsStyles.formRow, flex: 1 }}>
            <label style={paramsStyles.label}>Seuil de similarité (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={currentSettings.similarityThreshold}
              onChange={(e) =>
                updateCurrentSettings({
                  similarityThreshold: Number(e.target.value),
                })
              }
              style={paramsStyles.input}
            />
          </div>
        </div>
        <div style={paramsStyles.actionsRow}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isProcessing || !zipSource}
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
