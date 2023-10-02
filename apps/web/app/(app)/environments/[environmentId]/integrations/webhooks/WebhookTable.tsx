"use client";

import { Button } from "@formbricks/ui";
import { useState } from "react";
import { TWebhook } from "@formbricks/types/v1/webhooks";
import AddWebhookModal from "@/app/(app)/environments/[environmentId]/integrations/webhooks/AddWebhookModal";
import { TSurvey } from "@formbricks/types/v1/surveys";
import WebhookModal from "@/app/(app)/environments/[environmentId]/integrations/webhooks/WebhookDetailModal";
import { Webhook } from "lucide-react";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { TEnvironment } from "@formbricks/types/v1/environment";

export default function WebhookTable({
  environment,
  webhooks,
  surveys,
  children: [TableHeading, webhookRows],
}: {
  environment: TEnvironment;
  webhooks: TWebhook[];
  surveys: TSurvey[];
  children: [JSX.Element, JSX.Element[]];
}) {
  const [isWebhookDetailModalOpen, setWebhookDetailModalOpen] = useState(false);
  const [isAddWebhookModalOpen, setAddWebhookModalOpen] = useState(false);

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
      <div className="mb-6 text-right">
        <Button
          variant="darkCTA"
          onClick={() => {
            setAddWebhookModalOpen(true);
          }}>
          <Webhook className="mr-2 h-5 w-5 text-white" />
          Add Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environment={environment}
          noWidgetRequired={true}
          emptyMessage="Your webhooks will appear here as soon as you add them. ⏲️"
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
        environmentId={environment.id}
        open={isWebhookDetailModalOpen}
        setOpen={setWebhookDetailModalOpen}
        webhook={activeWebhook}
        surveys={surveys}
      />
      <AddWebhookModal
        environmentId={environment.id}
        surveys={surveys}
        open={isAddWebhookModalOpen}
        setOpen={setAddWebhookModalOpen}
      />
    </>
  );
}
