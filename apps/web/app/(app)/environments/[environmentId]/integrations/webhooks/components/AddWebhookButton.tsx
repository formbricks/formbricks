"use client";

import { Webhook } from "lucide-react";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { AddWebhookModal } from "./AddWebhookModal";

interface AddWebhookButtonProps {
  environment: TEnvironment;
  surveys: TSurvey[];
}

export const AddWebhookButton = ({ environment, surveys }: AddWebhookButtonProps) => {
  const [isAddWebhookModalOpen, setAddWebhookModalOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setAddWebhookModalOpen(true);
        }}>
        <Webhook className="mr-2 h-5 w-5 text-white" />
        Add Webhook
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
