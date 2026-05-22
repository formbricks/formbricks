import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import type { Workflow } from "@/lib/workflows/schema";
import { draftAtom, isDirtyAtom, selectedStepAtom } from "@/state/editor";

// SSR hydration enabler for global state
export function EditorHydrator({ workflow }: { workflow: Workflow }) {
  const setDraft = useSetAtom(draftAtom);
  const setDirty = useSetAtom(isDirtyAtom);
  const setSelected = useSetAtom(selectedStepAtom);
  const isDirty = useAtomValue(isDirtyAtom);

  const lastKeyRef = useRef<string | null>(null);
  const key = `${workflow.id}:${workflow.updatedAt}`;

  useEffect(() => {
    if (lastKeyRef.current === key) return;
    if (isDirty && lastKeyRef.current !== null) return;
    lastKeyRef.current = key;
    setDraft(workflow);
    setDirty(false);
    setSelected(null);
  }, [key, workflow, isDirty, setDraft, setDirty, setSelected]);

  return null;
}
