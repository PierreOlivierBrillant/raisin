import { useCallback, useRef, useState } from "react";
import type { StudentFolder } from "../types";
import { generateStandardizedZip } from "../services/generateStandardizedZip";

/** Options de génération du ZIP standardisé. */
interface UseGenerateZipOptions {
  /** Nom de sortie désiré pour le fichier généré (fallback: standardized.zip). */
  outputName?: string;
}

/** Informations et actions exposées par le hook de génération. */
interface ProgressInfo {
  /** Progression normalisée 0..1. */
  progress: number;
  /** Chemin courant traité (copie en cours). */
  currentPath: string;
  /** Indique si une génération est active. */
  isGenerating: boolean;
  /** Demande d'annulation (meilleur effort). */
  cancel: () => void;
  /** Lance la génération avec suivi de progression. */
  generate: (
    zipFile: File,
    results: StudentFolder[],
    opts?: UseGenerateZipOptions
  ) => Promise<void>;
}

/**
 * Encapsule la logique de génération d'une archive ZIP standardisée à partir
 * des dossiers étudiants analysés. Fournit progression, annulation via ref
 * et nettoyage automatique de l'état après finalisation.
 */
export function useGenerateZip(): ProgressInfo {
  const [progress, setProgress] = useState(0);
  const [currentPath, setCurrentPath] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const cancelRef = useRef(false);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const generate = useCallback(
    async (
      zipFile: File,
      results: StudentFolder[],
      opts?: UseGenerateZipOptions
    ) => {
      try {
        setIsGenerating(true);
        setProgress(0);
        cancelRef.current = false;
        await generateStandardizedZip(
          zipFile,
          results,
          { outputName: opts?.outputName || "standardized.zip" },
          (p, path) => {
            setProgress(p);
            if (path) setCurrentPath(path);
          },
          () => cancelRef.current
        );
      } catch (err: unknown) {
        interface CancelledLike {
          cancelled?: boolean;
        }
        const cancelled =
          typeof err === "object" &&
          err !== null &&
          (err as CancelledLike).cancelled;
        if (!cancelled) console.error("Erreur génération ZIP", err);
      } finally {
        setIsGenerating(false);
        setTimeout(() => {
          setProgress(0);
          setCurrentPath("");
        }, 1200);
      }
    },
    []
  );

  return { progress, currentPath, isGenerating, cancel, generate };
}
