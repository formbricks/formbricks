"use client";

import { WebhookModal } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookDetailModal";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TWebhook } from "@formbricks/types/webhooks";
import { EmptySpaceFiller } from "@formbricks/ui/components/EmptySpaceFiller";

interface WebhookTableProps {
  environment: TEnvironment;
  webhooks: TWebhook[];
  surveys: TSurvey[];
  children: [JSX.Element, JSX.Element[]];
}

export const WebhookTable = ({
  environment,
  webhooks,
  surveys,
  children: [TableHeading, webhookRows],
}: WebhookTableProps) => {
  const [isWebhookDetailModalOpen, setWebhookDetailModalOpen] = useState(false);
  const t = useTranslations();
  const [activeWebhook, setActiveWebhook] = useState<TWebhook>({
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

  const handleOpenWebhookDetailModalClick = (e, webhook: TWebhook) => {
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
      />
    </>
  );
};
