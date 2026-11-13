"use client";

import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { type TWorkflowWebhookTriggerNode } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { WebhookSampleSection } from "@/modules/ee/workflows/components/inspector/webhook-sample-section";
import { WebhookSecretUrlSection } from "@/modules/ee/workflows/components/inspector/webhook-secret-url-section";
import { WebhookTestPayloadSection } from "@/modules/ee/workflows/components/inspector/webhook-test-payload-section";
import { useWorkflowWebhook } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { hasSavedWebhookTrigger } from "@/modules/ee/workflows/lib/workflow-samples";
import { isWorkflowReadOnlyAtom, workflowAtom } from "@/modules/ee/workflows/state/editor";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Skeleton } from "@/modules/ui/components/skeleton";

interface WorkflowWebhookTriggerFormProps {
  node: TWorkflowWebhookTriggerNode;
  isEditable: boolean;
  onChange: (next: TWorkflowWebhookTriggerNode) => void;
}

/**
 * The Webhook trigger panel (ED3, ED6, mock screens 2 and 6): the Webhook Secret URL (masked, eye,
 * Copy, Regenerate), its last call and limits, the Sample payload (or how to get one) with the
 * Variables it offers, and the editable test payload a Test run uses. The Secret URL is a credential
 * (ADR 0041): only people who can edit the workflow see it, and it is kept out of session recordings.
 */
export const WorkflowWebhookTriggerForm = (_props: Readonly<WorkflowWebhookTriggerFormProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const isReadOnly = useAtomValue(isWorkflowReadOnlyAtom);
  const workflowId = workflow?.id ?? null;
  const isSaved = hasSavedWebhookTrigger(workflow);
  const webhookQuery = useWorkflowWebhook({ workflowId, enabled: isSaved && !isReadOnly });

  if (isReadOnly) {
    return (
      <Alert variant="info">
        <AlertDescription>{t("workspace.workflows.webhook_url_write_access_only")}</AlertDescription>
      </Alert>
    );
  }

  if (!workflowId || !isSaved || webhookQuery.isPending) {
    // The URL is issued when the new trigger's save lands, a moment after it is added.
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-4 w-40 rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
        <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_url_preparing")}</p>
      </div>
    );
  }

  if (webhookQuery.isError || !webhookQuery.data) {
    return (
      <Alert variant="error">
        <AlertDescription>
          {getV3ApiErrorMessage(webhookQuery.error, t("workspace.workflows.webhook_load_failed"))}
        </AlertDescription>
      </Alert>
    );
  }

  const webhook = webhookQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <WebhookSecretUrlSection
        workflowId={workflowId}
        url={webhook.url}
        lastCalledAt={webhook.lastCalledAt}
        lastCallerIp={webhook.lastCallerIp}
        canRegenerate={workflow?.status !== "archived"}
      />
      <WebhookSampleSection
        workflowId={workflowId}
        sample={webhook.sample}
        lastCalledAt={webhook.lastCalledAt}
        lastCallerIp={webhook.lastCallerIp}
        canSetSample={workflow?.status !== "archived"}
      />
      <WebhookTestPayloadSection workflowId={workflowId} sample={webhook.sample?.payload ?? null} />
    </div>
  );
};
