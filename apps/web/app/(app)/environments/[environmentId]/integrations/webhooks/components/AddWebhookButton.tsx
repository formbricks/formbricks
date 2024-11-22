"use client";

import { Button } from "@/modules/ui/components/button";
import { Webhook } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AddWebhookModal } from "./AddWebhookModal";

interface AddWebhookButtonProps {
  environment: TEnvironment;
  surveys: TSurvey[];
}

export const AddWebhookButton = ({ environment, surveys }: AddWebhookButtonProps) => {
  const t = useTranslations();
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
