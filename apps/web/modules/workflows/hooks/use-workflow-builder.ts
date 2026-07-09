"use client";

import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TPatchWorkflowInput, ZWorkflowDefinition } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  archiveWorkflow,
  disableWorkflow,
  enableWorkflow,
  getWorkflow,
  unarchiveWorkflow,
  updateWorkflow,
} from "@/modules/workflows/lib/api-client";
import { workflowDefinitionToFlowNodes } from "@/modules/workflows/lib/definition-to-flow";
import {
  hydrateWorkflowEditorAtom,
  isWorkflowDirtyAtom,
  isWorkflowSavingAtom,
  isWorkflowTransitioningAtom,
  markWorkflowDraftSavedAtom,
  setWorkflowAtom,
  setWorkflowSavingAtom,
  setWorkflowTransitioningAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowDescriptionAtom,
  workflowEditorAtom,
  workflowNameAtom,
} from "@/modules/workflows/state/editor";

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
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
  const isDirty = useAtomValue(isWorkflowDirtyAtom);
  const hydrateEditor = useSetAtom(hydrateWorkflowEditorAtom);
  const setWorkflow = useSetAtom(setWorkflowAtom);
  const markDraftSaved = useSetAtom(markWorkflowDraftSavedAtom);
  const isSaving = useAtomValue(isWorkflowSavingAtom);
  const isTransitioning = useAtomValue(isWorkflowTransitioningAtom);
  const setIsSaving = useSetAtom(setWorkflowSavingAtom);
  const setIsTransitioning = useSetAtom(setWorkflowTransitioningAtom);

  const [isLoading, setIsLoading] = useState(loadOnMount);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reload on workflowId change; abort in-flight fetches when the page navigates away.
  useEffect(() => {
    if (!loadOnMount) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

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
        hydrateEditor({
          workflow: loadedWorkflow,
          flowNodes: workflowDefinitionToFlowNodes(loadedWorkflow.definition, t),
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const message = getV3ApiErrorMessage(error, t("workspace.workflows.load_failed"));
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [workspaceId, workflowId, hydrateEditor, t, loadOnMount]);

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
      // Don't overlap with an in-flight save or lifecycle transition; a save landing during an
      // enable/disable can clobber the transitioned status (and vice versa).
      if (store.get(isWorkflowSavingAtom) || store.get(isWorkflowTransitioningAtom)) return false;

      const state = store.get(workflowEditorAtom);
      const currentWorkflow = state.workflow;
      const currentDefinition = state.definition;
      if (!currentWorkflow || !currentDefinition) return false;

      const trimmedName = state.workflowName.trim();
      if (!trimmedName) {
        if (!silent) toast.error(t("workspace.workflows.name_required"));
        return false;
      }

      const trimmedDescription = state.workflowDescription.trim() || null;
      const payload: TPatchWorkflowInput = { name: trimmedName, description: trimmedDescription };

      // Only include the definition in the PATCH when the API will accept it. Sending it while
      // the workflow is enabled would return a 422; disable first.
      if (currentWorkflow.status !== "enabled") {
        const parsedDefinition = ZWorkflowDefinition.safeParse(currentDefinition);
        if (!parsedDefinition.success) {
          if (!silent) {
            const issue = parsedDefinition.error.issues[0];
            toast.error(issue?.message ?? t("workspace.workflows.validation_failed"));
          }
          return false;
        }
        payload.definition = parsedDefinition.data;
      }

      setIsSaving(true);
      try {
        const savedWorkflow = await updateWorkflow(currentWorkflow.id, payload);
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
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.save_failed")));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [store, setWorkflow, markDraftSaved, setIsSaving, router, t]
  );

  // Draft signature of the last autosave that FAILED. The autosave effect refuses to retry the
  // exact same draft: without this, a persistent API failure would loop PATCH + error toast once
  // per debounce window forever. Any further edit produces a new signature and a fresh attempt.
  const failedAutosaveSignatureRef = useRef<string | null>(null);
  const draftSignature = JSON.stringify({ workflowName, workflowDescription, definition });

  // Autosave: the page-level instance (loadOnMount) persists any dirty draft shortly after the
  // user stops editing. Effect deps include the draft fields themselves so each keystroke resets
  // the timer (debounce), and isSaving so a save finishing re-arms it when edits piled up
  // mid-flight. Silent mode keeps validation noise out of the way while the user is mid-edit.
  useEffect(() => {
    if (!loadOnMount || isReadOnly) return;
    if (!isDirty || isSaving || isTransitioning) return;
    if (!workflow || workflow.status === "archived") return;
    if (failedAutosaveSignatureRef.current === draftSignature) return;

    const timeoutHandle = setTimeout(() => {
      void save({ silent: true }).then((saved) => {
        failedAutosaveSignatureRef.current = saved ? null : draftSignature;
      });
    }, WORKFLOW_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeoutHandle);
  }, [loadOnMount, isReadOnly, isDirty, isSaving, isTransitioning, workflow, draftSignature, save]);

  // Flush on unmount: the debounce window above means the freshest edits may not be persisted
  // yet when the user navigates away (tab switch, back navigation). Routed through a ref (kept
  // current every render) so the empty-dep cleanup runs at unmount only, never on re-renders.
  // Fire-and-forget: there is no UI left to report into.
  const flushOnUnmountRef = useRef<() => void>(() => undefined);
  flushOnUnmountRef.current = () => {
    if (!loadOnMount || isReadOnly) return;
    const state = store.get(workflowEditorAtom);
    if (!state.workflow || state.workflow.status === "archived") return;
    if (!store.get(isWorkflowDirtyAtom)) return;
    void save({ silent: true });
  };
  useEffect(() => () => flushOnUnmountRef.current(), []);

  // Warn on hard refresh / tab close while edits are unsaved: unlike SPA navigation, a page
  // unload kills the flush request above, so the native confirm is the only safety net. The
  // browser shows its own generic copy; custom text is ignored by modern browsers.
  useEffect(() => {
    if (!loadOnMount || isReadOnly) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!store.get(isWorkflowDirtyAtom)) return;
      event.preventDefault();
      // Legacy signal some Chromium versions still require for the dialog to appear.
      event.returnValue = "";
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
        // Enabling after a failed flush would publish a definition other than the one on screen,
        // right after the save-failure toast. Bail; the other transitions don't publish the
        // definition, so a stale metadata draft doesn't block them.
        if (!flushed && operation === "enable") return;
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
        toast.error(getV3ApiErrorMessage(error, op.failure()));
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
