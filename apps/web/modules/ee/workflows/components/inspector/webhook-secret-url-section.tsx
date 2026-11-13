"use client";

import { CopyIcon, EyeIcon, EyeOffIcon, InfoIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { WEBHOOK_CALLS_PER_MINUTE_PER_WORKFLOW, WEBHOOK_PAYLOAD_MAX_BYTES } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  useCallerIpLabel,
  useRelativeTime,
} from "@/modules/ee/workflows/components/inspector/webhook-trigger-labels";
import { useWorkflowWebhookMutations } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { maskWebhookSecretUrl } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

const SECRET_URL_FIELD_ID = "workflow-webhook-secret-url";

export const WebhookSecretUrlSection = ({
  workflowId,
  url,
  lastCalledAt,
  lastCallerIp,
  canRegenerate,
}: {
  readonly workflowId: string;
  readonly url: string;
  readonly lastCalledAt: string | null;
  readonly lastCallerIp: string | null;
  readonly canRegenerate: boolean;
}) => {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const callerIpLabel = useCallerIpLabel();
  const { regenerate } = useWorkflowWebhookMutations(workflowId);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("workspace.workflows.webhook_url_copied"));
    } catch {
      toast.error(t("workspace.workflows.webhook_url_copy_failed"));
    }
  };

  const limits = t("workspace.workflows.webhook_limits", {
    calls: WEBHOOK_CALLS_PER_MINUTE_PER_WORKFLOW,
    size: WEBHOOK_PAYLOAD_MAX_BYTES / 1024,
  });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={SECRET_URL_FIELD_ID}>{t("workspace.workflows.webhook_secret_url")}</Label>
        <TooltipRenderer
          className="max-w-72"
          tooltipContent={t("workspace.workflows.webhook_secret_url_tooltip")}>
          <InfoIcon
            className="size-3.5 text-slate-500"
            aria-label={t("workspace.workflows.webhook_secret_url_tooltip")}
          />
        </TooltipRenderer>
      </div>
      {/* ph-no-capture keeps the field (and the URL in it) out of PostHog session recordings. */}
      <div className="ph-no-capture flex items-center gap-2">
        <Input
          id={SECRET_URL_FIELD_ID}
          readOnly
          value={isRevealed ? url : maskWebhookSecretUrl(url)}
          className="ph-no-capture min-w-0 flex-1 bg-slate-50 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={isRevealed}
          aria-label={
            isRevealed ? t("workspace.workflows.webhook_url_hide") : t("workspace.workflows.webhook_url_show")
          }
          onClick={() => setIsRevealed((current) => !current)}>
          {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
          <CopyIcon />
          {t("common.copy")}
        </Button>
      </div>
      <p className="text-xs text-slate-500">{t("workspace.workflows.webhook_secret_url_help")}</p>
      {/* Wraps instead of overflowing the 360px inspector: the line may hold a long IPv6 network. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 basis-40 text-xs break-words text-slate-500">
          {lastCalledAt
            ? t("workspace.workflows.webhook_last_call", {
                time: relativeTime(lastCalledAt),
                ip: callerIpLabel(lastCallerIp),
                limits,
              })
            : t("workspace.workflows.webhook_never_called", { limits })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!canRegenerate || regenerate.isPending}
          loading={regenerate.isPending}
          onClick={() => setIsConfirmOpen(true)}>
          <RefreshCwIcon />
          {t("workspace.workflows.webhook_regenerate")}
        </Button>
      </div>
      <ConfirmationModal
        open={isConfirmOpen}
        setOpen={setIsConfirmOpen}
        title={t("workspace.workflows.webhook_regenerate_title")}
        body={t("workspace.workflows.webhook_regenerate_body")}
        buttonText={t("workspace.workflows.webhook_regenerate")}
        buttonVariant="destructive"
        buttonLoading={regenerate.isPending}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: () => {
              setIsConfirmOpen(false);
              setIsRevealed(false);
              toast.success(t("workspace.workflows.webhook_regenerated"));
            },
            onError: (error) =>
              toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.webhook_regenerate_failed"))),
          })
        }
        Icon={RefreshCwIcon}
      />
    </section>
  );
};
