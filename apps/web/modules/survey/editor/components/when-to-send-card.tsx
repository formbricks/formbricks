"use client";

import { ACTION_TYPE_ICON_LOOKUP } from "@/app/(app)/environments/[environmentId]/actions/utils";
import { getAccessFlags } from "@/lib/membership/utils";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { AddActionModal } from "@/modules/survey/editor/components/add-action-modal";
import { ActionClassInfo } from "@/modules/ui/components/action-class-info";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ActionClass, OrganizationRole } from "@prisma/client";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface WhenToSendCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  propActionClasses: ActionClass[];
  membershipRole?: OrganizationRole;
  projectPermission: TTeamPermission | null;
}

export const WhenToSendCard = ({
  environmentId,
  localSurvey,
  setLocalSurvey,
  propActionClasses,
  membershipRole,
  projectPermission,
}: WhenToSendCardProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(localSurvey.type === "app" ? true : false);
  const [isAddActionModalOpen, setAddActionModalOpen] = useState(false);
  const [actionClasses, setActionClasses] = useState<ActionClass[]>(propActionClasses);
  const [randomizerToggle, setRandomizerToggle] = useState(localSurvey.displayPercentage ? true : false);

  const { isMember } = getAccessFlags(membershipRole);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  const autoClose = localSurvey.autoClose !== null;
  const delay = localSurvey.delay !== 0;

  const handleRemoveTriggerEvent = (idx: number) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers = [...localSurvey.triggers.slice(0, idx), ...localSurvey.triggers.slice(idx + 1)];
    setLocalSurvey(updatedSurvey);
  };

  const handleAutoCloseToggle = () => {
    if (autoClose) {
      const updatedSurvey = { ...localSurvey, autoClose: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, autoClose: 10 };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleDelayToggle = () => {
    if (delay) {
      const updatedSurvey = { ...localSurvey, delay: 0 };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, delay: 5 };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleDisplayPercentageToggle = () => {
    if (localSurvey.displayPercentage) {
      const updatedSurvey = { ...localSurvey, displayPercentage: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, displayPercentage: 50 };
      setLocalSurvey(updatedSurvey);
    }
    setRandomizerToggle(!randomizerToggle);
  };

  const handleInputSeconds = (e: any) => {
    let value = parseInt(e.target.value);

    if (value < 1 || Number.isNaN(value)) {
      value = 0;
    }

    const updatedSurvey = { ...localSurvey, autoClose: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleTriggerDelay = (e: any) => {
    let value = parseInt(e.target.value);

    if (value < 1 || Number.isNaN(value)) {
      value = 0;
    }

    const updatedSurvey = { ...localSurvey, delay: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleRandomizerInput = (e) => {
    let value = parseFloat(e.target.value);

    if (Number.isNaN(value)) {
      value = 0.01;
    }

    if (value < 0.01) value = 0.01;
    if (value > 100) value = 100;

    // Round value to two decimal places. eg: 10.555(and higher like 10.556) -> 10.56 and 10.554(and lower like 10.553) ->10.55
    value = Math.round(value * 100) / 100;

    const updatedSurvey = { ...localSurvey, displayPercentage: value };
    setLocalSurvey(updatedSurvey);
  };

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  // Auto animate
  const [parent] = useAutoAnimate();

  const containsEmptyTriggers = useMemo(() => {
    return !localSurvey.triggers || !localSurvey.triggers.length || !localSurvey.triggers[0];
  }, [localSurvey]);

  if (localSurvey.type === "link") {
    return null; // Hide card completely
  }

  return (
    <>
      <Collapsible.Root
        open={open}
        onOpenChange={(openState) => {
          if (localSurvey.type !== "link") {
            setOpen(openState);
          }
        }}
        className="w-full rounded-lg border border-slate-300 bg-white">
        <Collapsible.CollapsibleTrigger
          asChild
          className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50"
          id="whenToSendCardTrigger">
          <div className="inline-flex px-4 py-4">
            <div className="flex items-center pl-2 pr-5">
              {containsEmptyTriggers ? (
                <div className="h-7 w-7 rounded-full border border-amber-500 bg-amber-50" />
              ) : (
                <CheckIcon
                  strokeWidth={3}
                  className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
                />
              )}
            </div>

            <div>
              <p className="font-semibold text-slate-800">{t("environments.surveys.edit.survey_trigger")}</p>
              <p className="mt-1 text-sm text-slate-500">
                {t("environments.surveys.edit.choose_the_actions_which_trigger_the_survey")}
              </p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>

        <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
          <hr className="py-1 text-slate-600" />

          <div className="px-3 pb-3 pt-1">
            <div className="filter-scrollbar flex flex-col gap-4 overflow-auto rounded-lg border border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                {t("environments.surveys.edit.trigger_survey_when_one_of_the_actions_is_fired")}
              </p>

              {localSurvey.triggers.filter(Boolean).map((trigger, idx) => {
                return (
                  <div className="flex items-center gap-2" key={trigger.actionClass.id}>
                    {idx !== 0 && <p className="ml-1 text-sm font-bold text-slate-700">or</p>}
                    <div
                      key={trigger.actionClass.id}
                      className="flex grow items-center justify-between rounded-md border border-slate-300 bg-white p-2 px-3">
                      <div>
                        <div className="mt-1 flex items-center">
                          <div className="mr-1.5 h-4 w-4 text-slate-600">
                            {ACTION_TYPE_ICON_LOOKUP[trigger.actionClass.type]}
                          </div>

                          <h4 className="text-sm font-semibold text-slate-600">{trigger.actionClass.name}</h4>
                        </div>
                        <ActionClassInfo actionClass={trigger.actionClass} />
                      </div>
                    </div>
                    <Trash2Icon
                      className="h-4 w-4 cursor-pointer text-slate-600"
                      onClick={() => handleRemoveTriggerEvent(idx)}
                    />
                  </div>
                );
              })}

              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAddActionModalOpen(true);
                  }}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {t("common.add_action")}
                </Button>
              </div>
            </div>

            {/* Survey Display Settings */}
            <div className="mb-4 mt-8 space-y-1 px-4">
              <h3 className="font-semibold text-slate-800">
                {t("environments.surveys.edit.survey_display_settings")}
              </h3>
              <p className="text-sm text-slate-500">
                {t("environments.surveys.edit.add_a_delay_or_auto_close_the_survey")}
              </p>
            </div>
            <AdvancedOptionToggle
              htmlId="delay"
              isChecked={delay}
              onToggle={handleDelayToggle}
              title={t("environments.surveys.edit.add_delay_before_showing_survey")}
              description={t(
                "environments.surveys.edit.wait_a_few_seconds_after_the_trigger_before_showing_the_survey"
              )}
              childBorder={true}>
              <label
                htmlFor="triggerDelay"
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {t("environments.surveys.edit.wait")}
                    <Input
                      type="number"
                      min="0"
                      id="triggerDelay"
                      value={localSurvey.delay.toString()}
                      onChange={(e) => handleTriggerDelay(e)}
                      className="ml-2 mr-2 inline w-16 bg-white text-center text-sm"
                    />
                    {t("environments.surveys.edit.seconds_before_showing_the_survey")}
                  </p>
                </div>
              </label>
            </AdvancedOptionToggle>
            <AdvancedOptionToggle
              htmlId="autoClose"
              isChecked={autoClose}
              onToggle={handleAutoCloseToggle}
              title={t("environments.surveys.edit.auto_close_on_inactivity")}
              description={t(
                "environments.surveys.edit.automatically_close_the_survey_if_the_user_does_not_respond_after_certain_number_of_seconds"
              )}
              childBorder={true}>
              <label htmlFor="autoCloseSeconds" className="cursor-pointer p-4">
                <p className="text-sm font-semibold text-slate-700">
                  {t("environments.surveys.edit.automatically_close_survey_after")}
                  <Input
                    type="number"
                    min="1"
                    id="autoCloseSeconds"
                    value={localSurvey.autoClose?.toString()}
                    onChange={(e) => handleInputSeconds(e)}
                    className="mx-2 inline w-16 bg-white text-center text-sm"
                  />
                  {t(
                    "environments.surveys.edit.seconds_after_trigger_the_survey_will_be_closed_if_no_response"
                  )}
                </p>
              </label>
            </AdvancedOptionToggle>
            <AdvancedOptionToggle
              htmlId="randomizer"
              isChecked={randomizerToggle}
              onToggle={handleDisplayPercentageToggle}
              title={t("environments.surveys.edit.show_survey_to_users")}
              description={t("environments.surveys.edit.only_display_the_survey_to_a_subset_of_the_users")}
              childBorder={true}>
              <label htmlFor="small-range" className="cursor-pointer p-4">
                <p className="text-sm font-semibold text-slate-700">
                  {t("environments.surveys.edit.show_to_x_percentage_of_targeted_users", {
                    percentage: localSurvey.displayPercentage,
                  })}
                  <Input
                    id="small-range"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={localSurvey.displayPercentage ?? ""}
                    onChange={handleRandomizerInput}
                    className="mx-2 inline w-20 bg-white text-center text-sm"
                  />
                </p>
              </label>
            </AdvancedOptionToggle>
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
      <AddActionModal
        environmentId={environmentId}
        open={isAddActionModalOpen}
        setOpen={setAddActionModalOpen}
        actionClasses={actionClasses}
        setActionClasses={setActionClasses}
        isReadOnly={isReadOnly}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
      />
    </>
  );
};
