"use client";

import { cn } from "@/lib/cn";
import { SurveyVariablesCardItem } from "@/modules/survey/editor/components/survey-variables-card-item";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { FileDigitIcon } from "lucide-react";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface SurveyVariablesCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (id: TSurveyQuestionId | null) => void;
}

const variablesCardId = `fb-variables-${Date.now()}`;

export const SurveyVariablesCard = ({
  localSurvey,
  setLocalSurvey,
  activeQuestionId,
  setActiveQuestionId,
}: SurveyVariablesCardProps) => {
  // [UseTusk]

  const open = activeQuestionId === variablesCardId;
  const { t } = useTranslate();
  const [parent] = useAutoAnimate();

  const setOpenState = (state: boolean) => {
    if (state) {
      setActiveQuestionId(variablesCardId);
    } else {
      setActiveQuestionId(null);
    }
  };

  return (
    <div className={cn(open ? "shadow-lg" : "shadow-md", "group z-10 flex flex-row rounded-lg bg-white")}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-t border-b border-l group-aria-expanded:rounded-bl-none"
        )}>
        <div className="flex w-full justify-center">
          <FileDigitIcon className="h-4 w-4" />
        </div>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpenState}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between rounded-r-lg p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">{t("common.variables")}</p>
              </div>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${open && "pb-6"}`} ref={parent}>
          <div className="flex flex-col gap-2" ref={parent}>
            {localSurvey.variables.length > 0 ? (
              localSurvey.variables.map((variable) => (
                <SurveyVariablesCardItem
                  key={variable.id}
                  mode="edit"
                  variable={variable}
                  localSurvey={localSurvey}
                  setLocalSurvey={setLocalSurvey}
                />
              ))
            ) : (
              <p className="mt-2 text-sm text-slate-500 italic">
                {t("environments.surveys.edit.no_variables_yet_add_first_one_below")}
              </p>
            )}
          </div>

          <SurveyVariablesCardItem mode="create" localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
