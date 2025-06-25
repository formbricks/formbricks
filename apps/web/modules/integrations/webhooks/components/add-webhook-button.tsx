"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { Webhook } from "lucide-react";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AddWebhookModal } from "./add-webhook-modal";

interface AddWebhookButtonProps {
  environment: TEnvironment;
  surveys: TSurvey[];
}

export const AddWebhookButton = ({ environment, surveys }: AddWebhookButtonProps) => {
  const { t } = useTranslate();
  const [isAddWebhookModalOpen, setAddWebhookModalOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setAddWebhookModalOpen(true);
        }}>
        <Webhook className="mr-2 h-5 w-5 text-white" />
        {t("environments.integrations.webhooks.add_webhook")}
      </Button>
      <AddWebhookModal
        environmentId={environment.id}
        surveys={surveys}
        open={isAddWebhookModalOpen}
        setOpen={setAddWebhookModalOpen}
      />
    </>
  );
};
