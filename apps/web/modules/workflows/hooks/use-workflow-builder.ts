"use client";

import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  isWorkflowSavingAtom,
  isWorkflowTransitioningAtom,
  setWorkflowAtom,
  setWorkflowSavingAtom,
  setWorkflowTransitioningAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowEditorAtom,
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
  const hydrateEditor = useSetAtom(hydrateWorkflowEditorAtom);
  const setWorkflow = useSetAtom(setWorkflowAtom);
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

  // Reads atom values via the store so the modal can call save() immediately after a
  // setDefinition write — useCallback closures otherwise pin the stale definition until the
  // next render, which would drop the just-edited node from the PATCH payload.
  const save = useCallback(async () => {
    // Don't overlap with an in-flight save or lifecycle transition — a save landing during an
    // enable/disable can clobber the transitioned status (and vice versa).
    if (store.get(isWorkflowSavingAtom) || store.get(isWorkflowTransitioningAtom)) return;

    const state = store.get(workflowEditorAtom);
    const currentWorkflow = state.workflow;
    const currentDefinition = state.definition;
    if (!currentWorkflow || !currentDefinition) return;

    const trimmedName = state.workflowName.trim();
    if (!trimmedName) {
      toast.error(t("workspace.workflows.name_required"));
      return;
    }

    const trimmedDescription = state.workflowDescription.trim() || null;
    const payload: TPatchWorkflowInput = { name: trimmedName, description: trimmedDescription };

    // Only include the definition in the PATCH when the API will accept it. Sending it while
    // the workflow is enabled would return a 422 — disable first.
    if (currentWorkflow.status !== "enabled") {
      const parsedDefinition = ZWorkflowDefinition.safeParse(currentDefinition);
      if (!parsedDefinition.success) {
        const issue = parsedDefinition.error.issues[0];
        toast.error(issue?.message ?? t("workspace.workflows.validation_failed"));
        return;
      }
      payload.definition = parsedDefinition.data;
    }

    setIsSaving(true);
    try {
      const savedWorkflow = await updateWorkflow(currentWorkflow.id, payload);
      setWorkflow(savedWorkflow);
      // Re-run the server loaders so server-resolved props (e.g. the email authoring context,
      // which resolves the trigger's bound survey) catch up with the just-saved definition.
      // Client state (atoms, form drafts) survives a refresh.
      router.refresh();
      toast.success(t("workspace.workflows.save_success"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.save_failed")));
    } finally {
      setIsSaving(false);
    }
  }, [store, setWorkflow, setIsSaving, router, t]);

  const transition = useCallback(
    async (operation: "enable" | "disable" | "archive" | "unarchive") => {
      if (!workflow) return;
      // Serialize against a save or another transition in flight — overlapping lifecycle writes
      // race and the last response to land wins, desyncing the displayed status from the server.
      if (store.get(isWorkflowSavingAtom) || store.get(isWorkflowTransitioningAtom)) return;

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
    [store, workflow, setWorkflow, setIsTransitioning, t]
  );

  return {
    workflow,
    definition,
    isLoading,
    loadError,
    isSaving,
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
