"use client";

import { type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import { Webhook } from "@formbricks/database/generated/client";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { WebhookModal } from "@/modules/integrations/webhooks/components/webhook-detail-modal";
import { EmptySpaceFiller } from "@/modules/ui/components/empty-space-filler";

interface WebhookTableProps {
  environment: TEnvironment;
  webhooks: Webhook[];
  surveys: TSurvey[];
  children: [JSX.Element, JSX.Element[]];
  isReadOnly: boolean;
}

export const WebhookTable = ({
  environment,
  webhooks,
  surveys,
  children: [TableHeading, webhookRows],
  isReadOnly,
}: WebhookTableProps) => {
  const [isWebhookDetailModalOpen, setWebhookDetailModalOpen] = useState(false);
  const { t } = useTranslation();
  const [activeWebhook, setActiveWebhook] = useState<Webhook>({
    environmentId: environment.id,
    id: "",
    name: "",
    url: "",
    source: "user",
    triggers: [],
    surveyIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const handleOpenWebhookDetailModalClick = (e, webhook: Webhook) => {
    e.preventDefault();
    setActiveWebhook(webhook);
    setWebhookDetailModalOpen(true);
  };

  return (
    <>
      {webhooks.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environment={environment}
          noWidgetRequired={true}
          emptyMessage={t("environments.integrations.webhooks.empty_webhook_message")}
        />
      ) : (
        <div className="rounded-lg border border-slate-200">
          {TableHeading}
          <div className="grid-cols-7">
            {webhooks.map((webhook, index) => (
              <button
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
      />
    </>
  );
};
