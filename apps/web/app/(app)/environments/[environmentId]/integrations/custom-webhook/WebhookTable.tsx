"use client";

import { Button } from "@formbricks/ui";
import { useState } from "react";
import { TWebhook } from "@formbricks/types/v1/webhooks";
import AddWebhookModal from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/AddWebhookModal";
import { TSurvey } from "@formbricks/types/v1/surveys";
import WebhookModal from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/WebhookDetailModal";
import { Webhook } from "lucide-react";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";

export default function WebhookTable({
  environmentId,
  webhooks,
  surveys,
  children: [TableHeading, webhookRows],
}: {
  environmentId: string;
  webhooks: TWebhook[];
  surveys: TSurvey[];
  children: [JSX.Element, JSX.Element[]];
}) {
  const [isWebhookDetailModalOpen, setWebhookDetailModalOpen] = useState(false);
  const [isAddWebhookModalOpen, setAddWebhookModalOpen] = useState(false);

  const [activeWebhook, setActiveWebhook] = useState<TWebhook>({
    environmentId,
    id: "",
    url: "",
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
          environmentId={environmentId}
          noWidgetRequired={true}
          emptyMessage="Your webhooks will appear here as soon as you add them. ⏲️"
        />
      ) : (
        <div className="rounded-lg border border-slate-200">
          {TableHeading}
          <div className="grid-cols-7">
            <div className="mt-2 grid h-16 grid-cols-12 content-center rounded-lg hover:bg-slate-100">
              <div className="col-span-4 flex items-center pl-6 text-sm">
                <div className="flex items-center">
                  <div className="text-left">
                    <div className="font-medium text-slate-900">webhook.url</div>
                  </div>
                </div>
              </div>
              <div className="col-span-4 my-auto text-center text-sm text-slate-500">
                <div className="font-medium text-slate-500">surveysbaazi</div>
              </div>
              <div className="col-span-2 my-auto text-center text-sm text-slate-500">
                <div className="font-medium text-slate-500">trigeysbaazi</div>
              </div>

              <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                kab bana
              </div>
              <div className="text-center"></div>
            </div>
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
        environmentId={environmentId}
        open={isWebhookDetailModalOpen}
        setOpen={setWebhookDetailModalOpen}
        webhook={activeWebhook}
        surveys={surveys}
      />
      <AddWebhookModal
        environmentId={environmentId}
        surveys={surveys}
        open={isAddWebhookModalOpen}
        setOpen={setAddWebhookModalOpen}
      />
    </>
  );
}
