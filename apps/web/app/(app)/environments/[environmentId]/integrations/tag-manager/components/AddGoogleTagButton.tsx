"use client";

import { Tag } from "lucide-react";
import { useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";

import { AddGoogleTagModal } from "./AddGoogleTagModal";

interface AddGoogleButtonProps {
  environment: TEnvironment;
  surveys: TSurvey[];
}

export const AddGoogleTagButton = ({ environment, surveys }: AddGoogleButtonProps) => {
  const [isAddWebhookModalOpen, setAddWebhookModalOpen] = useState(false);
  return (
    <>
      <Button
        variant="darkCTA"
        size="sm"
        onClick={() => {
          setAddWebhookModalOpen(true);
        }}>
        <Tag className="mr-2 h-5 w-5 text-white" />
        Add New Tag
      </Button>
      <AddGoogleTagModal
        environmentId={environment.id}
        surveys={surveys}
        open={isAddWebhookModalOpen}
        setOpen={setAddWebhookModalOpen}
      />
    </>
  );
};
