"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, FileDigitIcon } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { OptionIds } from "@/modules/survey/editor/components/option-ids";
import { SurveyVariablesCardItem } from "@/modules/survey/editor/components/survey-variables-card-item";

interface SurveyVariablesCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  activeElementId: string | null;
  setActiveElementId: (id: string | null) => void;
  quotas: TSurveyQuota[];
  inSettings?: boolean;
}

const variablesCardId = `fb-variables-${Date.now()}`;

export const SurveyVariablesCard = ({
  localSurvey,
  setLocalSurvey,
  activeElementId,
  setActiveElementId,
  quotas,
  inSettings = false,
}: SurveyVariablesCardProps) => {
  const open = activeElementId === variablesCardId;
  const { t } = useTranslation();
  const [parent] = useAutoAnimate();

  const setOpenState = (state: boolean) => {
    if (state) {
      // NOSONAR // This is ok for setOpenState
      setActiveElementId(variablesCardId);
    } else {
      setActiveElementId(null);
    }
  };

  const content = (
    <Collapsible.CollapsibleContent
      className={inSettings ? "flex flex-col" : `flex flex-col px-4 ${open && "pb-6"}`}
      ref={parent}>
      {inSettings && <hr className="py-1 text-slate-600" />}
      <div className={cn("flex flex-col gap-2", inSettings ? "p-3" : "")} ref={parent}>
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
            {t("workspace.surveys.edit.no_variables_yet_add_first_one_below")}
          </p>
        )}
      </div>

      <div className={inSettings ? "p-3 pt-0" : ""}>
        <SurveyVariablesCardItem
          mode="create"
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          quotas={quotas}
        />
      </div>

      {localSurvey.variables.length > 0 && (
        <div className={cn("mt-6", inSettings ? "p-3 pt-0" : "")}>
          <OptionIds type="variables" variables={localSurvey.variables} />
        </div>
      )}
    </Collapsible.CollapsibleContent>
  );

  if (inSettings) {
    return (
      <Collapsible.Root
        open={open}
        onOpenChange={setOpenState}
        className={cn(
          open ? "" : "hover:bg-slate-50",
          "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
        )}>
        <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
          <div className="inline-flex px-4 py-4">
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="size-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{t("common.variables")}</p>
              <p className="mt-1 text-sm text-slate-500">
                {t("workspace.surveys.edit.variables_description")}
              </p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        {content}
      </Collapsible.Root>
    );
  }

  return (
    <div className={cn(open ? "shadow-lg" : "shadow-md", "group z-10 flex flex-row rounded-lg bg-white")}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-b border-l border-t group-aria-expanded:rounded-bl-none"
        )}>
        <div className="flex w-full justify-center">
          <FileDigitIcon className="size-4" />
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
        {content}
      </Collapsible.Root>
    </div>
  );
};
