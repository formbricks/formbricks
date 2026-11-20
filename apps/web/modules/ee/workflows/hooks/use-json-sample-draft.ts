"use client";

import { useEffect, useRef, useState } from "react";
import { parsePastedSample } from "@/modules/ee/workflows/lib/webhook-trigger-panel";

export const SAMPLE_SAVE_DELAY_MS = 800;

/** Sends one sample; `onSuccess` runs once it is stored. Errors are the caller's to report. */
export type TSaveJsonSample = (
  payload: Record<string, unknown>,
  callbacks: { onSuccess: () => void }
) => void;

/**
 * The text of a JSON sample editor: the Webhook trigger's expected payload, or an HTTP request step's
 * expected response body. A valid object saves a moment after typing stops.
 *
 * What was typed stays in the editor after it is saved. The stored copy comes back formatted, with its
 * keys in the database's order, so showing it instead would move the cursor to the start and drop
 * whatever was typed while the save was in flight. Only a sample chosen outside the editor (a received
 * call, a Test request's response) replaces the text, through `save`.
 */
export const useJsonSampleDraft = (saveSample: TSaveJsonSample) => {
  const [draft, setDraft] = useState<string | null>(null);
  // The typed text the last save stored, so the card can tell an edit still waiting to save.
  const [savedText, setSavedText] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
  };

  useEffect(() => cancelPendingSave, []);

  /** Saves a sample chosen outside the editor; the editor then shows it as stored. */
  const save = (payload: Record<string, unknown>, onSaved?: () => void) => {
    cancelPendingSave();
    saveSample(payload, {
      onSuccess: () => {
        setDraft(null);
        setSavedText(null);
        onSaved?.();
      },
    });
  };

  const edit = (next: string) => {
    setDraft(next);
    cancelPendingSave();
    const check = next.trim() === "" ? null : parsePastedSample(next);
    if (!check?.ok) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveSample(check.payload, { onSuccess: () => setSavedText(next) });
    }, SAMPLE_SAVE_DELAY_MS);
  };

  const parsed = draft === null || draft.trim() === "" ? null : parsePastedSample(draft);
  return {
    draft,
    setDraft,
    parsed,
    edit,
    save,
    /** Valid typed text that isn't stored yet: the card says "Saving…". */
    hasUnsavedEdit: draft !== null && parsed?.ok === true && draft !== savedText,
  };
};
