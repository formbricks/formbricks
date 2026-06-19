"use client";

import { useAtomValue, useSetAtom, useStore } from "jotai";
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
  isCanvasLockedAtom,
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
   * When true, the hook fetches the workflow on mount. The page-level builder owns the load;
   * components that only need actions + atom state (e.g. the layout header CTA) pass false.
   */
  loadOnMount?: boolean;
}

export const useWorkflowBuilder = ({
  workflowId,
  isReadOnly,
  loadOnMount = true,
}: UseWorkflowBuilderArgs) => {
  const { t } = useTranslation();
  const store = useStore();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const hydrateEditor = useSetAtom(hydrateWorkflowEditorAtom);
  const setWorkflow = useSetAtom(setWorkflowAtom);
  const isSaving = useAtomValue(isWorkflowSavingAtom);
  const isTransitioning = useAtomValue(isWorkflowTransitioningAtom);
  const setIsSaving = useSetAtom(setWorkflowSavingAtom);
  const setIsTransitioning = useSetAtom(setWorkflowTransitioningAtom);
  const setCanvasLocked = useSetAtom(isCanvasLockedAtom);

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
  }, [workflowId, hydrateEditor, t, loadOnMount]);

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
      toast.success(t("workspace.workflows.save_success"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.save_failed")));
    } finally {
      setIsSaving(false);
    }
  }, [store, setWorkflow, setIsSaving, t]);

  const transition = useCallback(
    async (operation: "enable" | "disable" | "archive" | "unarchive") => {
      if (!workflow) return;

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
        // Enabling/archiving moves the workflow into a state where the definition is read-only,
        // so collapse back to a locked canvas on any lifecycle transition.
        setCanvasLocked(true);
        toast.success(op.success());
      } catch (error) {
        toast.error(getV3ApiErrorMessage(error, op.failure()));
      } finally {
        setIsTransitioning(false);
      }
    },
    [workflow, setWorkflow, setIsTransitioning, setCanvasLocked, t]
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
