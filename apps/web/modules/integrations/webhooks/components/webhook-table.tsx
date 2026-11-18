"use client";

import { type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { WebhookModal } from "@/modules/integrations/webhooks/components/webhook-detail-modal";
import type { TWebhookListItem } from "@/modules/integrations/webhooks/types/webhooks";
import { EmptyState } from "@/modules/ui/components/empty-state";

interface WebhookTableProps {
  workspaceId: string;
  webhooks: TWebhookListItem[];
  surveys: TSurvey[];
  children: [JSX.Element, JSX.Element[]];
  isReadOnly: boolean;
  allowInternalUrls: boolean;
  surveyVisibilityEnabled: boolean;
}

export const WebhookTable = ({
  workspaceId,
  webhooks,
  surveys,
  children: [TableHeading, webhookRows],
  isReadOnly,
  allowInternalUrls,
  surveyVisibilityEnabled,
}: Readonly<WebhookTableProps>) => {
  const [isWebhookDetailModalOpen, setWebhookDetailModalOpen] = useState(false);
  const { t } = useTranslation();
  // Lazy initializer: the placeholder's timestamps are read once, not on every render.
  const [activeWebhook, setActiveWebhook] = useState<TWebhookListItem>(() => ({
    workspaceId,
    id: "",
    name: "",
    url: "",
    source: "user",
    triggers: [],
    surveyIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    hasSecret: false,
  }));

  const handleOpenWebhookDetailModalClick = (e: React.MouseEvent, webhook: TWebhookListItem) => {
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
        surveyVisibilityEnabled={surveyVisibilityEnabled}
      />
    </>
  );
};
