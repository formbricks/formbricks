import { produce } from "immer";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { Workflow } from "@/lib/workflows/schema";
import { validate } from "@/lib/workflows/validate";

export type SelectedStep =
  | { kind: "trigger" }
  | { kind: "conditions" }
  | { kind: "condition"; id: string }
  | { kind: "action"; id: string };

export const draftAtom = atom<Workflow | null>(null);
export const selectedStepAtom = atom<SelectedStep | null>(null);
export const isDirtyAtom = atom<boolean>(false);

export const issuesAtom = atom((get) => {
  const draft = get(draftAtom);
  return draft ? validate(draft) : [];
});

export function useDraft(): Workflow | null {
  return useAtomValue(draftAtom);
}

export function useSelectedStep() {
  return useAtomValue(selectedStepAtom);
}

export function useSetSelectedStep() {
  return useSetAtom(selectedStepAtom);
}

export function useIsDirty() {
  return useAtomValue(isDirtyAtom);
}

export function useIssues() {
  return useAtomValue(issuesAtom);
}

export function useDraftMutator() {
  const setDraft = useSetAtom(draftAtom);
  const setDirty = useSetAtom(isDirtyAtom);
  return useCallback(
    (recipe: (draft: Workflow) => void) => {
      setDraft((current) => {
        if (!current) return current;
        return produce(current, recipe);
      });
      setDirty(true);
    },
    [setDraft, setDirty]
  );
}

export function useResetDraft() {
  const setDraft = useSetAtom(draftAtom);
  const setDirty = useSetAtom(isDirtyAtom);
  const setSelected = useSetAtom(selectedStepAtom);
  return useCallback(
    (workflow: Workflow | null) => {
      setDraft(workflow);
      setDirty(false);
      setSelected(null);
    },
    [setDraft, setDirty, setSelected]
  );
}
