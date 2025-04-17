"use client";

import { Input } from "@/modules/ui/components/input";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SurveyDescriptionCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((TSurvey) => TSurvey)) => void;
}

export const SurveyDescriptionCard = ({ localSurvey, setLocalSurvey }: SurveyDescriptionCardProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(true);
  const [parent] = useAutoAnimate();

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />{" "}
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              {t("environments.surveys.edit.survey_description")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.survey.edit.enter_a_description_to_tell_users_what_this_survey_is_about")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="pt-1 text-slate-600" />
        <div className="p-3 pl-20 pt-1">
          <Input
            defaultValue={localSurvey.description}
            placeholder="Enter a description..."
            onChange={(e) => {
              const updatedSurvey = { ...localSurvey, description: e.target.value };
              setLocalSurvey(updatedSurvey);
            }}
            className="h-8 w-full border-slate-200 border-white py-0 text-xs font-normal text-slate-500"
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
