"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Webhook } from "@formbricks/database/prisma-browser";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface WebhookCreatedModalProps {
  open: boolean;
  webhook: Webhook;
  onClose: () => void;
}

export const WebhookCreatedModal = ({ open, webhook, onClose }: WebhookCreatedModalProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t("common.copied_to_clipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <CheckIcon className="size-6 text-green-500" />
          <DialogTitle>{t("workspace.integrations.webhooks.webhook_created")}</DialogTitle>
          <DialogDescription>{t("workspace.integrations.webhooks.copy_secret_now")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-4">
          <div className="col-span-1">
            <Label>{t("workspace.integrations.webhooks.signing_secret")}</Label>
            <div className="mt-1 flex">
              <Input type="text" readOnly value={webhook.secret ?? ""} className="font-mono text-sm" />
              <Button
                type="button"
                variant="secondary"
                className="ml-2 whitespace-nowrap"
                onClick={() => copyToClipboard(webhook.secret ?? "")}>
                {copied ? (
                  <>
                    <CheckIcon className="size-4" />
                    {t("common.copied")}
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-4" />
                    {t("common.copy")}
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {t("workspace.integrations.webhooks.secret_copy_warning")}
            </p>
            <Link
              href="https://formbricks.com/docs/xm-and-surveys/core-features/integrations/webhooks#webhook-security-with-standard-webhooks"
              target="_blank"
              className="mt-2 inline-flex items-center gap-1 text-xs text-slate-600 underline hover:text-slate-800">
              {t("workspace.integrations.webhooks.learn_to_verify")}
              <ExternalLinkIcon className="size-3" />
            </Link>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("common.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
