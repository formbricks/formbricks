import React, { useEffect } from "react";
import { TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface RedirectUrlFormProps {
  endingCard: TSurveyRedirectUrlCard;
  updateSurvey: (input: Partial<TSurveyRedirectUrlCard>) => void;
  defaultRedirect: string;
}

export const RedirectUrlForm = ({ endingCard, updateSurvey, defaultRedirect }: RedirectUrlFormProps) => {

  useEffect(() => {
    if (!endingCard.url) {
      updateSurvey({ url: defaultRedirect });
    }
  }, [endingCard.url, defaultRedirect, updateSurvey]);

  return (
    <form className="mt-3 space-y-3">
      <div className="space-y-2">
        <Label>URL</Label>
        <Input
          id="redirectUrl"
          name="redirectUrl"
          className="bg-white"
          placeholder="https://member.digiopinion.com/overview"
          value={endingCard.url ?? defaultRedirect}
          onChange={(e) => updateSurvey({ url: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          id="redirectUrlLabel"
          name="redirectUrlLabel"
          className="bg-white"
          placeholder="Take More Surveys"
          value={endingCard.label}
          onChange={(e) => updateSurvey({ label: e.target.value })}
        />
      </div>
    </form>
  );
};
