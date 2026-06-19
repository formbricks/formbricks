"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ZWorkflowDefinition } from "@formbricks/workflows";
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
  setWorkflowAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowDescriptionAtom,
  workflowNameAtom,
} from "@/modules/workflows/state/editor";

interface UseWorkflowBuilderArgs {
  workflowId: string;
  isReadOnly: boolean;
}

export const useWorkflowBuilder = ({ workflowId, isReadOnly }: UseWorkflowBuilderArgs) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const hydrateEditor = useSetAtom(hydrateWorkflowEditorAtom);
  const setWorkflow = useSetAtom(setWorkflowAtom);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reload on workflowId change; abort in-flight fetches when the page navigates away.
  // Until the real DB-backed workflows ship (ENG-1222), placeholder ids resolve to in-memory
  // demo data so the builder UI is testable without hitting the API.
  useEffect(() => {
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
  }, [workflowId, hydrateEditor, t]);

  const isArchived = workflow?.status === "archived";
  const isEnabled = workflow?.status === "enabled";
  const canEdit = Boolean(workflow && !isReadOnly && !isEnabled && !isArchived);

  const save = useCallback(async () => {
    if (!workflow || !definition) return;

    const trimmedName = workflowName.trim();
    if (!trimmedName) {
      toast.error(t("workspace.workflows.name_required"));
      return;
    }

    const parsedDefinition = ZWorkflowDefinition.safeParse(definition);
    if (!parsedDefinition.success) {
      const issue = parsedDefinition.error.issues[0];
      toast.error(issue?.message ?? t("workspace.workflows.validation_failed"));
      return;
    }

    // Placeholder demo path: avoid hitting the API (no DB row); persist to local state instead.
    if (getPlaceholderWorkflowResource(workflow.id)) {
      setWorkflow({
        ...workflow,
        name: trimmedName,
        description: workflowDescription.trim() || null,
        definition: parsedDefinition.data,
        updatedAt: new Date().toISOString(),
      });
      toast.success(t("workspace.workflows.save_success"));
      return;
    }

    setIsSaving(true);
    try {
      const savedWorkflow = await updateWorkflow(workflow.id, {
        name: trimmedName,
        description: workflowDescription.trim() || null,
        definition: parsedDefinition.data,
      });
      setWorkflow(savedWorkflow);
      toast.success(t("workspace.workflows.save_success"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.save_failed")));
    } finally {
      setIsSaving(false);
    }
  }, [workflow, definition, workflowName, workflowDescription, setWorkflow, t]);

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
    [workflow, setWorkflow, t]
  );

  return {
    workflow,
    definition,
    isLoading,
    loadError,
    isSaving,
    isTransitioning,
    canEdit,
    isArchived,
    isEnabled,
    save,
    enable: () => transition("enable"),
    disable: () => transition("disable"),
    archive: () => transition("archive"),
    unarchive: () => transition("unarchive"),
  };
};
