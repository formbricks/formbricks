"use client";

import { SurveyVariableCardsItem } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/SurveyVariableCardsItem";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SurveyVariablesCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export const SurveyVariablesCard = ({
  activeQuestionId,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
}: SurveyVariablesCardProps) => {
  const open = activeQuestionId == "variables";

  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("variables");
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
        <p>🪣</p>
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Variables</p>
              </div>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <div className="flex flex-col gap-2">
            {localSurvey.variables.length > 0 ? (
              localSurvey.variables.map((variable) => (
                <SurveyVariableCardsItem
                  key={variable.id}
                  mode="edit"
                  variable={variable}
                  localSurvey={localSurvey}
                  setLocalSurvey={setLocalSurvey}
                />
              ))
            ) : (
              <p className="mt-2 text-sm italic text-slate-500">No variables yet. Add the first one below.</p>
            )}
          </div>

          <SurveyVariableCardsItem mode="create" localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
