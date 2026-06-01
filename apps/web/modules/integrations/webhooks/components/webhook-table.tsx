"use client";

import { Webhook } from "@prisma/client";
import { type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { WebhookModal } from "@/modules/integrations/webhooks/components/webhook-detail-modal";
import { EmptyState } from "@/modules/ui/components/empty-state";

interface WebhookTableProps {
  workspaceId: string;
  webhooks: Webhook[];
  surveys: TSurvey[];
  children: [JSX.Element, JSX.Element[]];
  isReadOnly: boolean;
  allowInternalUrls: boolean;
}

export const WebhookTable = ({
  workspaceId,
  webhooks,
  surveys,
  children: [TableHeading, webhookRows],
  isReadOnly,
  allowInternalUrls,
}: WebhookTableProps) => {
  const [isWebhookDetailModalOpen, setWebhookDetailModalOpen] = useState(false);
  const { t } = useTranslation();
  const [activeWebhook, setActiveWebhook] = useState<Webhook>({
    workspaceId,
    id: "",
    name: "",
    url: "",
    source: "user",
    triggers: [],
    surveyIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    secret: null,
  });

  const handleOpenWebhookDetailModalClick = (e: React.MouseEvent, webhook: Webhook) => {
    e.preventDefault();
    setActiveWebhook(webhook);
    setWebhookDetailModalOpen(true);
  };

  return (
    <>
      {webhooks.length === 0 ? (
        <EmptyState text={t("workspace.integrations.webhooks.empty_webhook_message")} />
      ) : (
        <div className="rounded-lg border border-slate-200">
          {TableHeading}
          <div className="grid-cols-7">
            {webhooks.map((webhook, index) => (
              <button
                type="button"
                onClick={(e) => {
                  handleOpenWebhookDetailModalClick(e, webhook);
                }}
                className="w-full"
                key={webhook.id}>
                {webhookRows[index]}
              </button>
            ))}
          </div>
        </div>
      )}
      <WebhookModal
        open={isWebhookDetailModalOpen}
        setOpen={setWebhookDetailModalOpen}
        webhook={activeWebhook}
        surveys={surveys}
        isReadOnly={isReadOnly}
        allowInternalUrls={allowInternalUrls}
      />
    </>
  );
};
