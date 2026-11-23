"use client";

import { atom, useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import {
  clearStoredTestPayload,
  readStoredTestPayload,
  writeStoredTestPayload,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";

// The test payload edits made on this page, per workflow, so the Webhook trigger panel and the Test
// run drawer show the same text while both are mounted. Browser storage keeps it across visits (ED6);
// a reset is kept here as null.
const editedTestPayloadsAtom = atom<Record<string, string | null>>({});

/**
 * The test payload kept in this browser for a workflow (null when there is none), and a setter that
 * stores an edit or, with null, clears it. Storage can be unavailable; edits then last for the page.
 */
export const useStoredTestPayload = (
  workflowId: string
): readonly [string | null, (text: string | null) => void] => {
  const [edits, setEdits] = useAtom(editedTestPayloadsAtom);
  const stored = useMemo(
    () => (Object.hasOwn(edits, workflowId) ? edits[workflowId] : readStoredTestPayload(workflowId)),
    [edits, workflowId]
  );
  const setStored = useCallback(
    (text: string | null) => {
      if (text === null) clearStoredTestPayload(workflowId);
      else writeStoredTestPayload(workflowId, text);
      setEdits((current) => ({ ...current, [workflowId]: text }));
    },
    [workflowId, setEdits]
  );
  return [stored, setStored] as const;
};
