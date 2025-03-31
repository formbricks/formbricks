"use client";

import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SurveyVisibilityCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey | ((TSurvey) => TSurvey)) => void;
}

export const SurveyVisibilityCard = ({ localSurvey, setLocalSurvey }: SurveyVisibilityCardProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(true);
  const [publicToggle, setPublicToggle] = useState(false);

  const handlePublicToggle = () => {
    setPublicToggle(!publicToggle);
    setLocalSurvey({ ...localSurvey, public: !publicToggle });
  };

  useEffect(() => {
    if (localSurvey.public) {
      setPublicToggle(true);
    }
  }, [localSurvey]);

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
            <p className="font-semibold text-slate-800">{t("environments.surveys.edit.survey_visibility")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.survey_visibility_description")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          {/* Run Survey on Date */}
          <AdvancedOptionToggle
            htmlId="public"
            isChecked={publicToggle}
            onToggle={handlePublicToggle}
            title={t("environments.surveys.edit.survey_make_public")}
            description={t("environments.surveys.edit.survey_make_public_description")}
            childBorder={true}></AdvancedOptionToggle>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
