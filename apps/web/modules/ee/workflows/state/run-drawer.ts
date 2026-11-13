import { atom } from "jotai";

/**
 * The editor's run drawer (ENG-7182): open while a Test run starts, runs or shows its result, and
 * the id of the run it shows once there is one. UI state only: the run itself lives in the TanStack
 * Query cache under `workflowRunKeys.detail(runId)`. Shared through the editor's Jotai store so the
 * canvas, which renders apart from the header that starts the run, can mark the branch taken.
 */
export interface TEditorRunDrawerState {
  isOpen: boolean;
  runId: string | null;
}

export const editorRunDrawerAtom = atom<TEditorRunDrawerState>({ isOpen: false, runId: null });

/** The run the canvas should mark: only while the drawer is open and shows a run. */
export const editorHighlightedRunIdAtom = atom((get) => {
  const drawer = get(editorRunDrawerAtom);
  return drawer.isOpen ? drawer.runId : null;
});
