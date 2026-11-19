"use client";

import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LockIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { useWorkflowWebhookMutations } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { maskWebhookSecretUrl } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

const SECRET_URL_FIELD_ID = "workflow-webhook-secret-url";

/**
 * The Webhook Secret URL as one compact card (redesign prototype): the masked URL, Copy, and a menu
 * for the rarer actions (show, regenerate). The URL is a credential (ADR 0057), so the card keeps one
 * line about keeping it private; the rest lives in the docs linked from the panel header.
 */
// About how many monospace characters fit on one row of the narrowest panel.
const SECRET_URL_CHARS_PER_ROW = 44;

export const WebhookSecretUrlSection = ({
  workflowId,
  url,
  canRegenerate,
}: {
  readonly workflowId: string;
  readonly url: string;
  readonly canRegenerate: boolean;
}) => {
  const { t } = useTranslation();
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

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={SECRET_URL_FIELD_ID} className="font-semibold">
            {t("workspace.workflows.webhook_secret_url")}
          </Label>
          <TooltipRenderer
            className="max-w-72"
            tooltipContent={t("workspace.workflows.webhook_secret_url_tooltip")}>
            <InfoIcon
              className="size-3.5 text-slate-500"
              aria-label={t("workspace.workflows.webhook_secret_url_tooltip")}
            />
          </TooltipRenderer>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
            <CopyIcon />
            {t("common.copy")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("workspace.workflows.webhook_url_actions")}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsRevealed((current) => !current)}>
                {isRevealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                {isRevealed
                  ? t("workspace.workflows.webhook_url_hide")
                  : t("workspace.workflows.webhook_url_show")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!canRegenerate || regenerate.isPending}
                onClick={() => setIsConfirmOpen(true)}>
                <RefreshCwIcon className="size-4" />
                {t("workspace.workflows.webhook_regenerate_menu")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* ph-no-capture keeps the URL out of PostHog session recordings. */}
      <div className="ph-no-capture px-3 pt-1.5 pb-2.5">
        {/* Wrapped, never cut off: the token is at the end of the URL, so a one-line field hid the
            only part Show changes. */}
        <textarea
          id={SECRET_URL_FIELD_ID}
          readOnly
          // `field-sizing: content` sizes it where supported; elsewhere (Firefox) rows does, roughly
          // one row per line of monospace text at this width.
          rows={Math.max(1, Math.ceil(url.length / SECRET_URL_CHARS_PER_ROW))}
          value={isRevealed ? url : maskWebhookSecretUrl(url)}
          className="ph-no-capture block field-sizing-content w-full resize-none rounded-md border-0 bg-slate-50 px-2 py-1.5 font-mono text-xs break-all text-slate-700 focus:ring-2 focus:ring-slate-300 focus:outline-hidden"
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <p className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        <LockIcon className="size-3.5 shrink-0" aria-hidden />
        {t("workspace.workflows.webhook_secret_url_private")}
      </p>
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
