"use client";

import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  type TPatchWorkflowInput,
  type TWorkflowDefinition,
  type TWorkflowResource,
  ZWorkflowDefinition,
} from "@formbricks/workflows";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  MUTATION_TIMEOUT_MS,
  archiveWorkflow,
  disableWorkflow,
  enableWorkflow,
  getWorkflow,
  unarchiveWorkflow,
  updateWorkflow,
} from "@/modules/ee/workflows/lib/api-client";
import { classifyWorkflowSaveError, getWorkflowApiErrorMessage } from "@/modules/ee/workflows/lib/api-error";
import { workflowDefinitionToFlowNodes } from "@/modules/ee/workflows/lib/definition-to-flow";
import {
  hydrateWorkflowEditorAtom,
  isWorkflowDirtyAtom,
  isWorkflowSavingAtom,
  isWorkflowTransitioningAtom,
  markWorkflowDraftSavedAtom,
  setWorkflowAtom,
  setWorkflowSaveErrorAtom,
  setWorkflowSavingAtom,
  setWorkflowTransitioningAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowDraftSignatureAtom,
  workflowEditorAtom,
  workflowSaveErrorAtom,
} from "@/modules/ee/workflows/state/editor";

interface UseWorkflowBuilderArgs {
  workflowId: string;
  isReadOnly: boolean;
  /**
   * URL workspace. Used to assert the loaded workflow belongs to the workspace in the URL —
   * the API authorizes by the workflow's own workspaceId, so without this check a workflow
   * URL on the wrong workspace would still render. Optional for callers that only need
   * actions + atom state (e.g. the header CTA passes loadOnMount: false and skips this).
   */
  workspaceId?: string;
  /**
   * When true, the hook fetches the workflow on mount. The page-level builder owns the load;
   * components that only need actions + atom state (e.g. the layout header CTA) pass false.
   */
  loadOnMount?: boolean;
}

// Long enough to batch a typing burst into one PATCH, short enough that edits are on the server
// before the user reaches for Test or navigates away.
const WORKFLOW_AUTOSAVE_DELAY_MS = 2000;

/** Why a draft can't be sent at all. Distinct from a save the API refused — nothing was attempted. */
type TInvalidWorkflowDraft = { code: "name_required" | "definition"; detail?: string };

/**
 * Builds the PATCH body for the current draft, or reports why it can't be sent. Lifted out of save()
 * so the wire-format rules sit in one place and save() stays inside the cognitive-complexity budget.
 */
const buildWorkflowPatch = (state: {
  workflow: TWorkflowResource;
  workflowName: string;
  workflowDescription: string;
  definition: TWorkflowDefinition;
}):
  | { patch: TPatchWorkflowInput; trimmedName: string; trimmedDescription: string | null }
  | { invalid: TInvalidWorkflowDraft } => {
  const trimmedName = state.workflowName.trim();
  if (!trimmedName) return { invalid: { code: "name_required" } };

  const trimmedDescription = state.workflowDescription.trim() || null;
  const patch: TPatchWorkflowInput = { name: trimmedName, description: trimmedDescription };

  // Only include the definition in the PATCH when the API will accept it. Sending it while the
  // workflow is enabled would return a 422; disable first.
  if (state.workflow.status !== "enabled") {
    const parsedDefinition = ZWorkflowDefinition.safeParse(state.definition);
    if (!parsedDefinition.success) {
      return { invalid: { code: "definition", detail: parsedDefinition.error.issues[0]?.message } };
    }
    patch.definition = parsedDefinition.data;
  }

  return { patch, trimmedName, trimmedDescription };
};

const describeInvalidDraft = (invalid: TInvalidWorkflowDraft, t: (key: string) => string): string => {
  if (invalid.code === "name_required") return t("workspace.workflows.name_required");
  // Zod's first issue is the most specific thing we can say; fall back when it carries no message.
  return invalid.detail ?? t("workspace.workflows.validation_failed");
};

export const useWorkflowBuilder = ({
  workspaceId,
  workflowId,
  isReadOnly,
  loadOnMount = true,
}: UseWorkflowBuilderArgs) => {
  const { t } = useTranslation();
  const router = useRouter();
  const store = useStore();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const isDirty = useAtomValue(isWorkflowDirtyAtom);
  const hydrateEditor = useSetAtom(hydrateWorkflowEditorAtom);
  const setWorkflow = useSetAtom(setWorkflowAtom);
  const markDraftSaved = useSetAtom(markWorkflowDraftSavedAtom);
  const isSaving = useAtomValue(isWorkflowSavingAtom);
  const isTransitioning = useAtomValue(isWorkflowTransitioningAtom);
  const setIsSaving = useSetAtom(setWorkflowSavingAtom);
  const setIsTransitioning = useSetAtom(setWorkflowTransitioningAtom);
  // Subscribed (not read through the store) on purpose: clearing the save error has to re-run the
  // autosave effect below, which is what lets the `online` listener re-arm a retry.
  const saveError = useAtomValue(workflowSaveErrorAtom);
  const draftSignature = useAtomValue(workflowDraftSignatureAtom);
  const setSaveError = useSetAtom(setWorkflowSaveErrorAtom);

  const [isFetching, setIsFetching] = useState(loadOnMount);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "Loading" means there is nothing correct to render yet, not merely that a request is in flight.
  // On a remount for the same workflow (the edit ↔ runs tab round-trip) the store still holds it, so
  // the editor stays on screen rather than flashing a skeleton over work that never left.
  const isLoading = isFetching && workflow?.id !== workflowId;

  // Reload on workflowId change; abort in-flight fetches when the page navigates away.
  useEffect(() => {
    if (!loadOnMount) return;
    const controller = new AbortController();
    setIsFetching(true);
    setLoadError(null);

    /**
     * Whether the editor already holds unsaved edits for the workflow being fetched. Re-read at each
     * use rather than captured: a draft can be saved (or newly edited) while the fetch is in flight.
     */
    const holdsUnsavedDraft = () =>
      store.get(workflowEditorAtom).workflow?.id === workflowId && store.get(isWorkflowDirtyAtom);

    getWorkflow(workflowId, controller.signal)
      .then((loadedWorkflow) => {
        // A fetch that resolved just before the effect aborted (fast workflowId nav) would
        // otherwise hydrate the stale workflow over the one now loading. .catch/.finally
        // already guard on aborted; mirror that here.
        if (controller.signal.aborted) return;
        // The API authorizes against the workflow's own workspaceId; reject if the URL
        // workspace doesn't match so we don't render a workflow under the wrong shell.
        if (workspaceId && loadedWorkflow.workspaceId !== workspaceId) {
          const message = t("workspace.workflows.load_failed");
          setLoadError(message);
          toast.error(message);
          return;
        }
        // Remounting the editor over an unsaved draft would destroy it: hydrate rebuilds from
        // initialWorkflowEditorState and re-seeds lastSavedDraft from the server, so the edits
        // vanish AND stop reading dirty — no toast, no pill, nothing to notice. Refresh only the
        // server-owned snapshot (setWorkflowAtom leaves the editable draft alone by design) and let
        // the autosave effect retry the draft it can still see.
        if (holdsUnsavedDraft()) {
          setWorkflow(loadedWorkflow);
          return;
        }
        hydrateEditor({
          workflow: loadedWorkflow,
          flowNodes: workflowDefinitionToFlowNodes(loadedWorkflow.definition, t),
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const message = getWorkflowApiErrorMessage(error, t("workspace.workflows.load_failed"));
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsFetching(false);
      });

    return () => controller.abort();
  }, [workspaceId, workflowId, hydrateEditor, setWorkflow, store, t, loadOnMount]);

  const isArchived = workflow?.status === "archived";
  const isEnabled = workflow?.status === "enabled";
  // Definition edits are blocked by the API while the workflow is enabled or archived
  // (see workflows.handlers.ts:patch). Metadata (name/description) edits are still allowed
  // while enabled, so we expose two flags so the inspector/header gate correctly.
  const canEditDefinition = Boolean(workflow && !isReadOnly && !isEnabled && !isArchived);
  const canEditMetadata = Boolean(workflow && !isReadOnly && !isArchived);

  // Reads atom values via the store so callers can save() immediately after an atom write;
  // useCallback closures otherwise pin the stale definition until the next render, which would
  // drop the just-edited node from the PATCH payload.
  // `silent` is the autosave mode: validation problems skip the save quietly (the editor already
  // surfaces them live via workflowValidityAtom) and success produces no toast.
  // Resolves true only when the draft was actually persisted.
  const save = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}): Promise<boolean> => {
      const state = store.get(workflowEditorAtom);
      const currentWorkflow = state.workflow;
      const currentDefinition = state.definition;
      if (!currentWorkflow || !currentDefinition) return false;

      // Built ahead of the overlap guard below so an explicit save always explains why it did
      // nothing. Behind it, clearing the name while a save or transition was in flight returned
      // silently — and a title rename committed with Enter would look like it did nothing.
      const built = buildWorkflowPatch({
        workflow: currentWorkflow,
        workflowName: state.workflowName,
        workflowDescription: state.workflowDescription,
        definition: currentDefinition,
      });
      // An unsendable draft is not a failed save: nothing was attempted, so no saveError is
      // recorded, and a silent autosave stays quiet because the editor already surfaces validation
      // problems live via workflowValidityAtom.
      if ("invalid" in built) {
        if (!silent) toast.error(describeInvalidDraft(built.invalid, t));
        return false;
      }
      const { patch, trimmedName, trimmedDescription } = built;

      // Don't overlap with an in-flight save or lifecycle transition; a save landing during an
      // enable/disable can clobber the transitioned status (and vice versa).
      if (store.get(isWorkflowSavingAtom) || store.get(isWorkflowTransitioningAtom)) return false;

      // Read before the await so a failure records the draft that was actually sent, not whatever
      // the user has typed by the time the request comes back.
      const attemptedSignature = store.get(workflowDraftSignatureAtom);

      setIsSaving(true);
      try {
        const savedWorkflow = await updateWorkflow(currentWorkflow.id, patch);
        setWorkflow(savedWorkflow);
        // Snapshot the EDITOR STATE captured at send time (not re-read, so edits that landed
        // while the PATCH was in flight still count as dirty). Deliberately the raw
        // currentDefinition rather than the parsed payload: dirty tracking asks "did the user
        // change anything since the last save", and zod normalization (defaults, stripped legacy
        // keys, shape-ordered keys) would make a parsed snapshot never compare equal to the
        // state it was parsed from — leaving the editor permanently dirty and autosave looping.
        markDraftSaved({
          workflowName: trimmedName,
          workflowDescription: trimmedDescription ?? "",
          definition: currentDefinition,
        });
        // Re-run the server loaders so server-resolved props (e.g. the email authoring context,
        // which resolves the trigger's bound survey) catch up with the just-saved definition.
        // Client state (atoms, form drafts) survives a refresh.
        router.refresh();
        if (!silent) toast.success(t("workspace.workflows.save_success"));
        return true;
      } catch (error) {
        // Persistent state instead of a toast that fades before the user notices (ENG-1970): the
        // header pill reads this and stays failed until a save lands. Written here rather than from
        // the autosave effect's callback so it batches with the setIsSaving(false) below — the
        // effect then re-runs seeing both, with no reliance on microtask-vs-render ordering.
        // Doubles as the effect's no-retry guard, keeping a broken draft from looping one PATCH per
        // debounce window.
        setSaveError({
          draftSignature: attemptedSignature,
          kind: classifyWorkflowSaveError(error),
          detail: error instanceof V3ApiError ? error.detail : null,
        });
        if (!silent) toast.error(getWorkflowApiErrorMessage(error, t("workspace.workflows.save_failed")));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [store, setWorkflow, markDraftSaved, setIsSaving, setSaveError, router, t]
  );

  // Autosave: the page-level instance (loadOnMount) persists any dirty draft shortly after the
  // user stops editing. Effect deps include the draft signature so each keystroke resets the timer
  // (debounce), and isSaving so a save finishing re-arms it when edits piled up mid-flight.
  // Silent mode keeps validation noise out of the way while the user is mid-edit; a failure is
  // reported by the header pill instead (see save()).
  useEffect(() => {
    if (!loadOnMount || isReadOnly) return;
    if (!isDirty || isSaving || isTransitioning) return;
    if (!workflow || workflow.status === "archived") return;
    // Never re-send a draft the server already refused: without this a persistent API failure would
    // loop one PATCH per debounce window forever. Any further edit changes the signature, and a
    // reconnect clears the error outright (below) — either way the next attempt is a fresh one.
    if (saveError?.draftSignature === draftSignature) return;

    const timeoutHandle = setTimeout(() => void save({ silent: true }), WORKFLOW_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeoutHandle);
  }, [
    loadOnMount,
    isReadOnly,
    isDirty,
    isSaving,
    isTransitioning,
    workflow,
    draftSignature,
    saveError,
    save,
  ]);

  // Reconnecting is the one event worth retrying on its own: the guard above deliberately refuses to
  // re-send the same draft, so an offline failure would otherwise sit there until the user happened
  // to type again. Clearing the error re-arms the debounced effect, which re-checks
  // dirty/archived/transitioning itself — no retry logic lives here. Only "unreachable" qualifies;
  // being back online says nothing about a draft the API actively rejected. navigator.onLine is a
  // nudge, never what the pill reads: a wrong "online" costs exactly one PATCH, which then either
  // succeeds or records the failure again.
  useEffect(() => {
    if (!loadOnMount || isReadOnly) return;
    const handleOnline = () => {
      if (store.get(workflowSaveErrorAtom)?.kind !== "unreachable") return;
      setSaveError(null);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadOnMount, isReadOnly, store, setSaveError]);

  // Flush on unmount: the debounce window above means the freshest edits may not be persisted
  // yet when the user navigates away (tab switch, back navigation). Routed through a ref (kept
  // current after every render) so the empty-dep cleanup runs at unmount only, never on
  // re-renders. The result isn't awaited, but it isn't lost either: save() records a failure into
  // the editor store, which outlives this page whenever the surrounding layout does.
  const flushOnUnmountRef = useRef<() => void>(() => undefined);
  // Deliberately dependency-less: refreshes the closure on every commit. Writing the ref here
  // rather than during render keeps it out of the render phase.
  useEffect(() => {
    flushOnUnmountRef.current = () => {
      if (!loadOnMount || isReadOnly) return;
      const state = store.get(workflowEditorAtom);
      if (!state.workflow || state.workflow.status === "archived") return;
      if (!store.get(isWorkflowDirtyAtom)) return;

      if (!state.isSaving && !state.isTransitioning) {
        void save({ silent: true });
        return;
      }
      // A write is already in flight, carrying the snapshot taken when it started — anything typed
      // since is only in the draft. save() refuses to overlap it and there is no render left to
      // re-arm the debounce, so firing now would drop those edits silently, even fully online.
      // Wait for the write to settle instead, then send what is still unsaved. Subscribing to the
      // store rather than the promise keeps save() untouched, and the store belongs to the
      // surrounding layout so it outlives this page.
      //
      // This store survives navigating between workflows, but the wait cannot leak across one: the
      // first write that clears isSaving/isTransitioning unsubscribes, and hydrating another
      // workflow is itself such a write (hydrate rebuilds from initialWorkflowEditorState, so
      // isSaving resets to false and the fresh draft reads clean). Hence no workflow-id guard here
      // — it would be unreachable.
      const unsubscribe = store.sub(workflowEditorAtom, () => {
        const current = store.get(workflowEditorAtom);
        if (current.isSaving || current.isTransitioning) return;
        unsubscribe();
        // The in-flight write may have persisted exactly what was pending.
        if (!store.get(isWorkflowDirtyAtom)) return;
        void save({ silent: true });
      });
      // The mutation timeout bounds the request, not this listener: a write that somehow never
      // settles would otherwise pin the subscription — and the unmounted page it closes over — for
      // the rest of the session. Give up a little after the request itself would have.
      setTimeout(unsubscribe, MUTATION_TIMEOUT_MS + WORKFLOW_AUTOSAVE_DELAY_MS);
    };
  });
  useEffect(() => () => flushOnUnmountRef.current(), []);

  // Warn on hard refresh / tab close while edits are unsaved: unlike SPA navigation, a page
  // unload kills the flush request above, so the native confirm is the only safety net. The
  // browser shows its own generic copy; custom text is ignored by modern browsers.
  useEffect(() => {
    if (!loadOnMount || isReadOnly) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!store.get(isWorkflowDirtyAtom)) return;
      event.preventDefault();
      event.returnValue = ""; // NOSONAR(typescript:S1874) -- legacy Chromium still requires returnValue for the confirm dialog
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [loadOnMount, isReadOnly, store]);

  const transition = useCallback(
    async (operation: "enable" | "disable" | "archive" | "unarchive") => {
      if (!workflow) return;
      // Serialize against a save or another transition in flight; overlapping lifecycle writes
      // race and the last response to land wins, desyncing the displayed status from the server.
      if (store.get(isWorkflowSavingAtom) || store.get(isWorkflowTransitioningAtom)) return;

      // Flush pending edits first so the lifecycle change acts on what the user sees; enable in
      // particular validates the persisted definition, not the local draft.
      if (store.get(isWorkflowDirtyAtom)) {
        const flushed = await save({ silent: true });
        // Enabling after a failed flush would publish a definition other than the one on screen.
        // Bail with a toast of its own — the flush is silent, so without this the click would look
        // like it did nothing. The other transitions don't publish the definition, so a stale
        // metadata draft doesn't block them.
        if (!flushed && operation === "enable") {
          toast.error(t("workspace.workflows.enable_blocked_unsaved_changes"));
          return;
        }
      }

      // One dispatch table keeps the API call + i18n keys aligned per operation; the scanner can
      // still see every literal `t("…")` key because they sit inline in the map below.
      const lifecycleOps = {
        enable: {
          run: enableWorkflow,
          success: () => t("workspace.workflows.enable_success"),
          failure: () => t("workspace.workflows.enable_failed"),
        },
        disable: {
          run: disableWorkflow,
          success: () => t("workspace.workflows.disable_success"),
          failure: () => t("workspace.workflows.disable_failed"),
        },
        archive: {
          run: archiveWorkflow,
          success: () => t("workspace.workflows.archive_success"),
          failure: () => t("workspace.workflows.archive_failed"),
        },
        unarchive: {
          run: unarchiveWorkflow,
          success: () => t("workspace.workflows.unarchive_success"),
          failure: () => t("workspace.workflows.unarchive_failed"),
        },
      } as const;
      const op = lifecycleOps[operation];

      setIsTransitioning(true);
      try {
        const transitioned = await op.run(workflow.id);
        setWorkflow(transitioned);
        toast.success(op.success());
      } catch (error) {
        toast.error(getWorkflowApiErrorMessage(error, op.failure()));
      } finally {
        setIsTransitioning(false);
      }
    },
    [store, workflow, setWorkflow, setIsTransitioning, save, t]
  );

  return {
    workflow,
    definition,
    isLoading,
    loadError,
    isSaving,
    isDirty,
    isTransitioning,
    canEditDefinition,
    canEditMetadata,
    isArchived,
    isEnabled,
    save,
    enable: () => transition("enable"),
    disable: () => transition("disable"),
    archive: () => transition("archive"),
    unarchive: () => transition("unarchive"),
  };
};
