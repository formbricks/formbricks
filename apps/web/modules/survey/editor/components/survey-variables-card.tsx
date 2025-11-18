"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { FileDigitIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { OptionIds } from "@/modules/survey/editor/components/option-ids";
import { SurveyVariablesCardItem } from "@/modules/survey/editor/components/survey-variables-card-item";

interface SurveyVariablesCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (id: TSurveyQuestionId | null) => void;
  quotas: TSurveyQuota[];
}

const variablesCardId = `fb-variables-${Date.now()}`;

export const SurveyVariablesCard = ({
  localSurvey,
  setLocalSurvey,
  activeQuestionId,
  setActiveQuestionId,
  quotas,
}: SurveyVariablesCardProps) => {
  const open = activeQuestionId === variablesCardId;
  const { t } = useTranslation();
  const [parent] = useAutoAnimate();

  const setOpenState = (state: boolean) => {
    if (state) {
      // NOSONAR // This is ok for setOpenState
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
          "flex w-10 items-center justify-center rounded-l-lg border-b border-l border-t group-aria-expanded:rounded-bl-none"
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
                  quotas={quotas}
                />
              ))
            ) : (
              <p className="mt-2 text-sm italic text-slate-500">
                {t("environments.surveys.edit.no_variables_yet_add_first_one_below")}
              </p>
            )}
          </div>

          <SurveyVariablesCardItem
            mode="create"
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            quotas={quotas}
          />

          {localSurvey.variables.length > 0 && (
            <div className="mt-6">
              <OptionIds type="variables" variables={localSurvey.variables} />
            </div>
          )}
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
