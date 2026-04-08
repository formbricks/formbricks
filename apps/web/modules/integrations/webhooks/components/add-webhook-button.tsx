"use client";

import { Webhook } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@/modules/ui/components/button";
import { AddWebhookModal } from "./add-webhook-modal";

interface AddWebhookButtonProps {
  workspaceId: string;
  surveys: TSurvey[];
}

export const AddWebhookButton = ({ workspaceId, surveys }: AddWebhookButtonProps) => {
  const { t } = useTranslation();
  const [isAddWebhookModalOpen, setAddWebhookModalOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setAddWebhookModalOpen(true);
        }}>
        <Webhook className="mr-2 h-5 w-5 text-white" />
        {t("workspace.integrations.webhooks.add_webhook")}
      </Button>
      <AddWebhookModal
        workspaceId={workspaceId}
        surveys={surveys}
        open={isAddWebhookModalOpen}
        setOpen={setAddWebhookModalOpen}
      />
    </>
  );
};
