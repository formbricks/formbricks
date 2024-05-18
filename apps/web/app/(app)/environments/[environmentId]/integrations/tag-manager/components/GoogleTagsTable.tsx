"use client";

import AddGoogleTagModal from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/AddGoogleTagModal";
import GoogleTagModal from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/GoogleTagDetailModal";
import { Tag } from "lucide-react";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TGoogleTag } from "@formbricks/types/google-tags";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";

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
      <div className="mb-6 text-right">
        <Button
          variant="darkCTA"
          onClick={() => {
            setAddTagModalOpen(true);
          }}>
          <Tag className="mr-2 h-5 w-5 text-white" />
          Add New Tag
        </Button>
      </div>

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
