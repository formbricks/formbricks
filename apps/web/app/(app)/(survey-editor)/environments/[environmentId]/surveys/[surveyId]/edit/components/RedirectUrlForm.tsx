import React from "react";
import { TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface RedirectUrlFormProps {
  endingCard: TSurveyRedirectUrlCard;
  updateSurvey: (input: Partial<TSurveyRedirectUrlCard>) => void;
}

export const RedirectUrlForm = ({ endingCard, updateSurvey }: RedirectUrlFormProps) => {
  return (
    <form className="mt-3 space-y-3">
      <div className="space-y-2">
        <Label>URL</Label>
        <Input
          id="redirectUrl"
          name="redirectUrl"
          className="bg-white"
          placeholder="https://formbricks.com/signup"
          value={endingCard.url}
          onChange={(e) => updateSurvey({ url: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          id="redirectUrlLabel"
          name="redirectUrlLabel"
          className="bg-white"
          placeholder="Formbricks App"
          value={endingCard.label}
          onChange={(e) => updateSurvey({ label: e.target.value })}
        />
      </div>
    </form>
  );
};
