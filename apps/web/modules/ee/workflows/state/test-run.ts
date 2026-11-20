import { atom } from "jotai";
import type { TTestRunFailure } from "@/modules/ee/workflows/lib/test-run";

/** Why a Test run did not start or failed: a refusal, or the draft could not be saved first. */
export type TWorkflowTestRunFailure = TTestRunFailure | "unsaved";

/**
 * The latest Test run started from this workflow's header or Runs view (review point 1). UI state
 * only: the run itself lives in the TanStack Query cache under `workflowRunKeys.detail(runId)`. Kept
 * in the editor's Jotai store, which the Editor and Runs tabs share, so a run started in the Editor
 * shows up in Runs, and the Runs view's test panel knows a run is in flight whichever button started it.
 */
export interface TEditorTestRunState {
  isRunning: boolean;
  /** The last Test run that came back; the Runs view selects it once. */
  runId: string | null;
  /** A Response completed workflow, saved and waiting for a response to be picked. */
  isPickingResponse: boolean;
  failure: TWorkflowTestRunFailure | null;
  error: unknown;
}

export const EMPTY_TEST_RUN_STATE: TEditorTestRunState = {
  isRunning: false,
  runId: null,
  isPickingResponse: false,
  failure: null,
  error: null,
};

export const editorTestRunAtom = atom<TEditorTestRunState>(EMPTY_TEST_RUN_STATE);

/**
 * The run a canvas marks. The editor's canvas never shows one (runs are read in the Runs view); the
 * Runs view's read-only canvas sets it in its own store.
 */
export const canvasRunIdAtom = atom<string | null>(null);

/**
 * The Runs view's test form ("New test run": the test input and "Run test"), open or folded. In the
 * editor store, so the header's Test button can open it from either tab.
 */
export const isTestFormOpenAtom = atom(false);

/** Bumped to ask the Runs view to focus "Run test" once the form shows. */
export const testFormFocusRequestAtom = atom(0);

/** The Runs view's left panel (the test form and the run list), collapsed to its pill or not. */
export const isRunsListCollapsedAtom = atom(false);

/**
 * Opens the test form, with the panel holding it, and asks for "Run test" to be focused: what the
 * header's Test button does.
 */
export const openTestFormAtom = atom(null, (_get, set) => {
  set(isRunsListCollapsedAtom, false);
  set(isTestFormOpenAtom, true);
  set(testFormFocusRequestAtom, (request) => request + 1);
});

/**
 * Whether the test form shows: opened by hand, or held open while a run waits for a response to be
 * picked or explains why it didn't start.
 */
export const isTestFormShownAtom = atom((get) => {
  const testRun = get(editorTestRunAtom);
  return get(isTestFormOpenAtom) || testRun.isPickingResponse || testRun.failure !== null;
});

/** Closes the test form, with the pick it waited for and the failure it explained. */
export const closeTestFormAtom = atom(null, (get, set) => {
  set(isTestFormOpenAtom, false);
  const testRun = get(editorTestRunAtom);
  if (!testRun.isRunning)
    set(editorTestRunAtom, { ...testRun, isPickingResponse: false, failure: null, error: null });
});
