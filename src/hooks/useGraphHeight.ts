import { useCallback, useEffect, useState } from "react";

/**
 * Calcule dynamiquement la hauteur disponible pour une zone graphique
 * identifiée par l'attribut [data-graph-area]. Recalcule sur resize et sur
 * variation explicite des dépendances fournies. Retourne au minimum `min`.
 * @param deps Tableau de dépendances externe déclenchant un recalcul initial.
 * @param min Hauteur minimale.
 * @param bottomPadding Marge retirée du viewport pour éviter un débordement.
 */
export function useGraphHeight(
  deps: unknown[] = [],
  min = 400,
  bottomPadding = 24
) {
  const [graphHeight, setGraphHeight] = useState<number>(min);
  const recompute = useCallback(() => {
    const el = document.querySelector(
      "[data-graph-area]"
    ) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const h = vh - rect.top - bottomPadding;
    setGraphHeight(h > min ? h : min);
  }, [min, bottomPadding]);

  useEffect(() => {
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return graphHeight;
}
