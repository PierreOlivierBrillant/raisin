import { useCallback, useState } from "react";

interface StepConfig {
  id: number | string;
  disabled?: boolean;
}

/**
 * Gestion minimale d'un index de stepper avec protection optionnelle
 * (steps[] passé à goTo pour ignorer les étapes disabled).
 */
export function useStepperState<T extends number | string>(initial: T) {
  const [current, setCurrent] = useState<T>(initial);
  const goTo = useCallback((id: T, steps?: StepConfig[]) => {
    if (steps) {
      const step = steps.find((s) => s.id === id);
      if (step?.disabled) return;
    }
    setCurrent(id);
  }, []);
  return { current, goTo, setCurrent } as const;
}
