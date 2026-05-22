import { atom, useAtomValue } from "jotai";

export const aiEnabledAtom = atom<boolean>(false);

export function useIsAiEnabled() {
  return useAtomValue(aiEnabledAtom);
}
