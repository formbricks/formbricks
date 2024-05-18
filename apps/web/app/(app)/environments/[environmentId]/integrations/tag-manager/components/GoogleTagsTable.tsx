"use client";

import GoogleTagModal from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/GoogleTagDetailModal";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TGoogleTag } from "@formbricks/types/google-tags";
import { TSurvey } from "@formbricks/types/surveys";
import { EmptySpaceFiller } from "@formbricks/ui/EmptySpaceFiller";

import { AddGoogleTagModal } from "./AddGoogleTagModal";

export default function GoogleTagsTable({
  environment,
  googleTags,
  surveys,
  children: [TableHeading, webhookRows],
}: {
  environment: TEnvironment;
  googleTags: TGoogleTag[];
  surveys: TSurvey[];
  children: [JSX.Element, JSX.Element[]];
}) {
  const [isWebhookDetailModalOpen, setWebhookDetailModalOpen] = useState(false);
  const [isAddTagModalOpen, setAddTagModalOpen] = useState(false);

  const [activeWebhook, setActiveWebhook] = useState<TGoogleTag>({
    environmentId: environment.id,
    id: "",
    name: "",
    gtmId: "",
    surveyIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const handleOpenWebhookDetailModalClick = (e, webhook: TGoogleTag) => {
    e.preventDefault();
    setActiveWebhook(webhook);
    setWebhookDetailModalOpen(true);
  };

  return (
    <>
      {googleTags.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environment={environment}
          noWidgetRequired={true}
          emptyMessage="Your tag will appear here as soon as you add them. ⏲️"
        />
      ) : (
        <div className="rounded-lg border border-slate-200">
          {TableHeading}
          <div className="grid-cols-7">
            {googleTags.map((webhook, index) => (
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

      <GoogleTagModal
        environmentId={environment.id}
        open={isWebhookDetailModalOpen}
        setOpen={setWebhookDetailModalOpen}
        tag={activeWebhook}
        surveys={surveys}
      />
      <AddGoogleTagModal
        environmentId={environment.id}
        surveys={surveys}
        open={isAddTagModalOpen}
        setOpen={setAddTagModalOpen}
      />
    </>
  );
}
