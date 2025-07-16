"use client";

import { WebhookOverviewTab } from "@/modules/integrations/webhooks/components/webhook-overview-tab";
import { WebhookSettingsTab } from "@/modules/integrations/webhooks/components/webhook-settings-tab";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Webhook } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { WebhookIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface WebhookModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  webhook: Webhook;
  surveys: TSurvey[];
  isReadOnly: boolean;
}

export const WebhookModal = ({ open, setOpen, webhook, surveys, isReadOnly }: WebhookModalProps) => {
  const { t } = useTranslate();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      title: t("common.overview"),
      children: <WebhookOverviewTab webhook={webhook} surveys={surveys} />,
    },
    {
      title: t("common.settings"),
      children: (
        <WebhookSettingsTab webhook={webhook} surveys={surveys} setOpen={setOpen} isReadOnly={isReadOnly} />
      ),
    },
  ];

  const webhookName = webhook.name || t("common.webhook"); // NOSONAR // We want to check for empty strings

  const handleTabClick = (index: number) => {
    setActiveTab(index);
  };

  useEffect(() => {
    if (!open) {
      setActiveTab(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick>
        <DialogHeader>
          <WebhookIcon />
          <DialogTitle>{webhookName}</DialogTitle> {/* NOSONAR // We want to check for empty strings */}
          <DialogDescription>{webhook.url}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-full w-full flex-col">
            <div className="flex w-full items-center justify-center space-x-2 border-b border-slate-200 px-6">
              {tabs.map((tab, index) => (
                <button
                  key={tab.title}
                  type="button"
                  className={`mr-4 px-1 pb-3 focus:outline-none ${
                    activeTab === index
                      ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => handleTabClick(index)}>
                  {tab.title}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto pt-4">{tabs[activeTab].children}</div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
