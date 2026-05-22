import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { aiEnabledAtom } from "./settings";

// SSR hydration enabler for global state
export function SettingsHydrator({ aiEnabled }: { aiEnabled: boolean }) {
  const setAiEnabled = useSetAtom(aiEnabledAtom);

  useEffect(() => {
    setAiEnabled(aiEnabled);
  }, [setAiEnabled, aiEnabled]);

  return null;
}
