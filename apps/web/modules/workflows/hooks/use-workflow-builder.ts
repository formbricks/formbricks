"use client";

import { useAtomValue, useSetAtom } from "jotai";
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
import { getPlaceholderWorkflowResource } from "@/modules/workflows/lib/placeholder-data";
import {
  hydrateWorkflowEditorAtom,
  isWorkflowSavingAtom,
  isWorkflowTransitioningAtom,
  setWorkflowAtom,
  setWorkflowSavingAtom,
  setWorkflowTransitioningAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowDescriptionAtom,
  workflowNameAtom,
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
  const workflow = useAtomValue(workflowAtom);
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
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
  // Until the real DB-backed workflows ship (ENG-1222), placeholder ids resolve to in-memory
  // demo data so the builder UI is testable without hitting the API.
  useEffect(() => {
    if (!loadOnMount) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    const placeholderWorkflow = getPlaceholderWorkflowResource(workflowId);
    if (placeholderWorkflow) {
      hydrateEditor({
        workflow: placeholderWorkflow,
        flowNodes: workflowDefinitionToFlowNodes(placeholderWorkflow.definition, t),
      });
      setIsLoading(false);
      return () => controller.abort();
    }

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

  const save = useCallback(async () => {
    if (!workflow || !definition) return;

    const trimmedName = workflowName.trim();
    if (!trimmedName) {
      toast.error(t("workspace.workflows.name_required"));
      return;
    }

    const trimmedDescription = workflowDescription.trim() || null;
    const payload: TPatchWorkflowInput = { name: trimmedName, description: trimmedDescription };

    // Only include the definition in the PATCH when the API will accept it. Sending it while
    // the workflow is enabled would return a 422 — disable first.
    if (!isEnabled) {
      const parsedDefinition = ZWorkflowDefinition.safeParse(definition);
      if (!parsedDefinition.success) {
        const issue = parsedDefinition.error.issues[0];
        toast.error(issue?.message ?? t("workspace.workflows.validation_failed"));
        return;
      }
      payload.definition = parsedDefinition.data;
    }

    // Placeholder demo path: avoid hitting the API (no DB row); persist to local state instead.
    if (getPlaceholderWorkflowResource(workflow.id)) {
      setWorkflow({
        ...workflow,
        name: trimmedName,
        description: trimmedDescription,
        definition: payload.definition ?? workflow.definition,
        updatedAt: new Date().toISOString(),
      });
      toast.success(t("workspace.workflows.save_success"));
      return;
    }

    setIsSaving(true);
    try {
      const savedWorkflow = await updateWorkflow(workflow.id, payload);
      setWorkflow(savedWorkflow);
      toast.success(t("workspace.workflows.save_success"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.save_failed")));
    } finally {
      setIsSaving(false);
    }
  }, [workflow, definition, workflowName, workflowDescription, isEnabled, setWorkflow, setIsSaving, t]);

  const transition = useCallback(
    async (operation: "enable" | "disable" | "archive" | "unarchive") => {
      if (!workflow) return;

      // Inline literal t() calls per branch so the translation scanner can see every key.
      const toastSuccess = () => {
        if (operation === "enable") toast.success(t("workspace.workflows.enable_success"));
        else if (operation === "disable") toast.success(t("workspace.workflows.disable_success"));
        else if (operation === "archive") toast.success(t("workspace.workflows.archive_success"));
        else toast.success(t("workspace.workflows.unarchive_success"));
      };
      const toastFailure = (error: unknown) => {
        if (operation === "enable")
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.enable_failed")));
        else if (operation === "disable")
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.disable_failed")));
        else if (operation === "archive")
          toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.archive_failed")));
        else toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.unarchive_failed")));
      };

      // Placeholder demo path: toggle status locally instead of calling the lifecycle endpoint.
      if (getPlaceholderWorkflowResource(workflow.id)) {
        const nextStatus =
          operation === "enable"
            ? "enabled"
            : operation === "disable"
              ? "disabled"
              : operation === "archive"
                ? "archived"
                : "draft";
        setWorkflow({ ...workflow, status: nextStatus, updatedAt: new Date().toISOString() });
        toastSuccess();
        return;
      }

      setIsTransitioning(true);
      try {
        const transitioned =
          operation === "enable"
            ? await enableWorkflow(workflow.id)
            : operation === "disable"
              ? await disableWorkflow(workflow.id)
              : operation === "archive"
                ? await archiveWorkflow(workflow.id)
                : await unarchiveWorkflow(workflow.id);
        setWorkflow(transitioned);
        toastSuccess();
      } catch (error) {
        toastFailure(error);
      } finally {
        setIsTransitioning(false);
      }
    },
    [workflow, setWorkflow, setIsTransitioning, t]
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
