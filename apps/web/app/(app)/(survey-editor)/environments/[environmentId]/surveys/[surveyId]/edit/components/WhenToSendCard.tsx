"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import {
  CheckIcon,
  Code2Icon,
  MousePointerClickIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TActionClass } from "@formbricks/types/action-classes";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { AddActionModal } from "./AddActionModal";

interface WhenToSendCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  propActionClasses: TActionClass[];
  membershipRole?: TMembershipRole;
}

export const WhenToSendCard = ({
  environmentId,
  localSurvey,
  setLocalSurvey,
  propActionClasses,
  membershipRole,
}: WhenToSendCardProps) => {
  const [open, setOpen] = useState(
    localSurvey.type === "app" || localSurvey.type === "website" ? true : false
  );
  const [isAddActionModalOpen, setAddActionModalOpen] = useState(false);
  const [actionClasses, setActionClasses] = useState<TActionClass[]>(propActionClasses);
  const [randomizerToggle, setRandomizerToggle] = useState(localSurvey.displayPercentage ? true : false);

  const { isViewer } = getAccessFlags(membershipRole);

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
              <p className="font-semibold text-slate-800">Survey Trigger</p>
              <p className="mt-1 text-sm text-slate-500">Choose the actions which trigger the survey.</p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>

        <Collapsible.CollapsibleContent>
          <hr className="py-1 text-slate-600" />

          <div className="px-3 pb-3 pt-1">
            <div className="filter-scrollbar flex flex-col gap-4 overflow-auto rounded-lg border border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Trigger survey when one of the actions is fired...
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
                            {trigger.actionClass.type === "code" ? (
                              <Code2Icon className="h-4 w-4" />
                            ) : trigger.actionClass.type === "noCode" ? (
                              <MousePointerClickIcon className="h-4 w-4" />
                            ) : trigger.actionClass.type === "automatic" ? (
                              <SparklesIcon className="h-4 w-4" />
                            ) : null}
                          </div>

                          <h4 className="text-sm font-semibold text-slate-600">{trigger.actionClass.name}</h4>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {trigger.actionClass.description && (
                            <span className="mr-1">{trigger.actionClass.description}</span>
                          )}
                          {trigger.actionClass.type === "code" && (
                            <span className="mr-1 border-l border-slate-400 pl-1 first:border-l-0 first:pl-0">
                              Key: <b>{trigger.actionClass.key}</b>
                            </span>
                          )}
                          {trigger.actionClass.type === "noCode" &&
                            trigger.actionClass.noCodeConfig?.type === "click" &&
                            trigger.actionClass.noCodeConfig?.elementSelector.cssSelector && (
                              <span className="mr-1 border-l border-slate-400 pl-1 first:border-l-0 first:pl-0">
                                CSS Selector:{" "}
                                <b>{trigger.actionClass.noCodeConfig?.elementSelector.cssSelector}</b>
                              </span>
                            )}
                          {trigger.actionClass.type === "noCode" &&
                            trigger.actionClass.noCodeConfig?.type === "click" &&
                            trigger.actionClass.noCodeConfig?.elementSelector.innerHtml && (
                              <span className="mr-1 border-l border-slate-400 pl-1 first:border-l-0 first:pl-0">
                                Inner Text:{" "}
                                <b>{trigger.actionClass.noCodeConfig?.elementSelector.innerHtml}</b>
                              </span>
                            )}
                          {trigger.actionClass.type === "noCode" &&
                          trigger.actionClass.noCodeConfig?.urlFilters &&
                          trigger.actionClass.noCodeConfig.urlFilters.length > 0 ? (
                            <span className="mr-1 border-l border-slate-400 pl-1 first:border-l-0 first:pl-0">
                              URL Filters:{" "}
                              {trigger.actionClass.noCodeConfig.urlFilters.map((urlFilter, index) => (
                                <span key={index}>
                                  {urlFilter.rule} <b>{urlFilter.value}</b>
                                  {trigger.actionClass.type === "noCode" &&
                                    index !==
                                      (trigger.actionClass.noCodeConfig?.urlFilters?.length || 0) - 1 &&
                                    ", "}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>
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
                  Add action
                </Button>
              </div>
            </div>

            {/* Survey Display Settings */}
            <div className="mb-4 mt-8 space-y-1 px-4">
              <h3 className="font-semibold text-slate-800">Survey Display Settings</h3>
              <p className="text-sm text-slate-500">Add a delay or auto-close the survey</p>
            </div>
            <AdvancedOptionToggle
              htmlId="delay"
              isChecked={delay}
              onToggle={handleDelayToggle}
              title="Add delay before showing survey"
              description="Wait a few seconds after the trigger before showing the survey"
              childBorder={true}>
              <label
                htmlFor="triggerDelay"
                className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Wait
                    <Input
                      type="number"
                      min="0"
                      id="triggerDelay"
                      value={localSurvey.delay.toString()}
                      onChange={(e) => handleTriggerDelay(e)}
                      className="ml-2 mr-2 inline w-16 bg-white text-center text-sm"
                    />
                    seconds before showing the survey.
                  </p>
                </div>
              </label>
            </AdvancedOptionToggle>
            <AdvancedOptionToggle
              htmlId="autoClose"
              isChecked={autoClose}
              onToggle={handleAutoCloseToggle}
              title="Auto close on inactivity"
              description="Automatically close the survey if the user does not respond after certain number of seconds"
              childBorder={true}>
              <label htmlFor="autoCloseSeconds" className="cursor-pointer p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Automatically close survey after
                  <Input
                    type="number"
                    min="1"
                    id="autoCloseSeconds"
                    value={localSurvey.autoClose?.toString()}
                    onChange={(e) => handleInputSeconds(e)}
                    className="mx-2 inline w-16 bg-white text-center text-sm"
                  />
                  seconds with no initial interaction.
                </p>
              </label>
            </AdvancedOptionToggle>
            <AdvancedOptionToggle
              htmlId="randomizer"
              isChecked={randomizerToggle}
              onToggle={handleDisplayPercentageToggle}
              title="Show survey to % of users"
              description="Only display the survey to a subset of the users"
              childBorder={true}>
              <label htmlFor="small-range" className="cursor-pointer p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Show to {localSurvey.displayPercentage}% of targeted users
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
        isViewer={isViewer}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
      />
    </>
  );
};
