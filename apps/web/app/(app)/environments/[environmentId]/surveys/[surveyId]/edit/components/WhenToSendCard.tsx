"use client";

import AddNoCodeActionModal from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/components/AddActionModal";
import InlineTriggers from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/InlineTriggers";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TSurvey } from "@formbricks/types/surveys";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/Select";
import { TabBar } from "@formbricks/ui/TabBar";

interface WhenToSendCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  propActionClasses: TActionClass[];
  membershipRole?: TMembershipRole;
}

export default function WhenToSendCard({
  environmentId,
  localSurvey,
  setLocalSurvey,
  propActionClasses,
  membershipRole,
}: WhenToSendCardProps) {
  const [open, setOpen] = useState(localSurvey.type === "web" ? true : false);
  const [isAddEventModalOpen, setAddEventModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [actionClasses, setActionClasses] = useState<TActionClass[]>(propActionClasses);
  const [randomizerToggle, setRandomizerToggle] = useState(localSurvey.displayPercentage ? true : false);

  const [activeTriggerTab, setActiveTriggerTab] = useState(
    !!localSurvey?.inlineTriggers ? "inline" : "relation"
  );
  const tabs = [
    {
      id: "relation",
      label: "Saved Actions",
    },
    {
      id: "inline",
      label: "Custom Actions",
    },
  ];

  const { isViewer } = getAccessFlags(membershipRole);

  const autoClose = localSurvey.autoClose !== null;
  const delay = localSurvey.delay !== 0;

  const addTriggerEvent = useCallback(() => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers = [...localSurvey.triggers, ""];
    setLocalSurvey(updatedSurvey);
  }, [localSurvey, setLocalSurvey]);

  const setTriggerEvent = useCallback(
    (idx: number, actionClassName: string) => {
      const updatedSurvey = { ...localSurvey };
      const newActionClass = actionClasses!.find((actionClass) => {
        return actionClass.name === actionClassName;
      });
      if (!newActionClass) {
        throw new Error("Action class not found");
      }
      updatedSurvey.triggers[idx] = newActionClass.name;
      setLocalSurvey(updatedSurvey);
    },
    [actionClasses, localSurvey, setLocalSurvey]
  );

  const removeTriggerEvent = (idx: number) => {
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

    if (value < 1) value = 1;

    const updatedSurvey = { ...localSurvey, autoClose: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleTriggerDelay = (e: any) => {
    let value = parseInt(e.target.value);
    const updatedSurvey = { ...localSurvey, delay: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleRandomizerInput = (e) => {
    const updatedSurvey = { ...localSurvey, displayPercentage: parseInt(e.target.value) };
    setLocalSurvey(updatedSurvey);
  };

  useEffect(() => {
    if (isAddEventModalOpen) return;

    if (activeIndex !== null) {
      const newActionClass = actionClasses[actionClasses.length - 1].name;
      const currentActionClass = localSurvey.triggers[activeIndex];

      if (newActionClass !== currentActionClass) {
        setTriggerEvent(activeIndex, newActionClass);
      }

      setActiveIndex(null);
    }
  }, [actionClasses, activeIndex, setTriggerEvent, isAddEventModalOpen, localSurvey.triggers]);

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  //create new empty trigger on page load, remove one click for user
  useEffect(() => {
    if (localSurvey.triggers.length === 0) {
      addTriggerEvent();
    }
  }, [addTriggerEvent, localSurvey.triggers.length]);

  const containsEmptyTriggers = useMemo(() => {
    const noTriggers = !localSurvey.triggers || !localSurvey.triggers.length || !localSurvey.triggers[0];
    const noInlineTriggers =
      !localSurvey.inlineTriggers ||
      (!localSurvey.inlineTriggers?.codeConfig && !localSurvey.inlineTriggers?.noCodeConfig);

    if (noTriggers && noInlineTriggers) {
      return true;
    }

    return false;
  }, [localSurvey]);

  // for inline triggers, if both the codeConfig and noCodeConfig are empty, we consider it as empty
  useEffect(() => {
    const inlineTriggers = localSurvey?.inlineTriggers ?? {};
    if (Object.keys(inlineTriggers).length === 0) {
      setLocalSurvey((prevSurvey) => {
        return {
          ...prevSurvey,
          inlineTriggers: null,
        };
      });
    }
  }, [localSurvey?.inlineTriggers, setLocalSurvey]);

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
          className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
          <div className="inline-flex px-4 py-4">
            <div className="flex items-center pl-2 pr-5">
              {containsEmptyTriggers ? (
                <div className="h-8 w-8 rounded-full border border-amber-500 bg-amber-50" />
              ) : (
                <CheckIcon
                  strokeWidth={3}
                  className="h-7 w-7 rounded-full border bg-green-400 p-1.5 text-white"
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
            <div className="flex flex-col overflow-hidden rounded-lg border-2 border-slate-100">
              <TabBar
                tabs={tabs}
                activeId={activeTriggerTab}
                setActiveId={setActiveTriggerTab}
                tabStyle="button"
                className="bg-slate-100"
              />
              <div className="p-3">
                {activeTriggerTab === "inline" ? (
                  <div className="flex flex-col">
                    <InlineTriggers localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
                  </div>
                ) : (
                  <>
                    {!isAddEventModalOpen &&
                      localSurvey.triggers?.map((triggerEventClass, idx) => (
                        <div className="mt-2" key={idx}>
                          <div className="inline-flex items-center">
                            <p className="mr-2 w-14 text-right text-sm">{idx === 0 ? "When" : "or"}</p>
                            <Select
                              value={triggerEventClass}
                              onValueChange={(actionClassName) => setTriggerEvent(idx, actionClassName)}>
                              <SelectTrigger className="w-[240px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <button
                                  type="button"
                                  className="flex w-full items-center space-x-2 rounded-md p-1 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-500"
                                  value="none"
                                  onClick={() => {
                                    setAddEventModalOpen(true);
                                    setActiveIndex(idx);
                                  }}>
                                  <PlusIcon className="mr-1 h-5 w-5" />
                                  Add Action
                                </button>
                                <SelectSeparator />
                                {actionClasses.map((actionClass) => (
                                  <SelectItem
                                    value={actionClass.name}
                                    key={actionClass.name}
                                    title={actionClass.description ? actionClass.description : ""}>
                                    {actionClass.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="mx-2 text-sm">action is performed</p>
                            <button type="button" onClick={() => removeTriggerEvent(idx)}>
                              <TrashIcon className="ml-3 h-4 w-4 text-slate-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    <div className="px-6 py-4">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          addTriggerEvent();
                        }}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Add condition
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

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
                className="flex w-full cursor-pointer items-center rounded-lg  border bg-slate-50 p-4">
                <div className="">
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
              <div className="w-full">
                <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
                  <h3 className="mb-4 text-sm font-semibold text-slate-700">
                    Show to {localSurvey.displayPercentage}% of targeted users
                  </h3>
                  <input
                    id="small-range"
                    type="range"
                    min="1"
                    max="100"
                    value={localSurvey.displayPercentage ?? 50}
                    onChange={handleRandomizerInput}
                    className="range-sm mb-6 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
                  />
                </div>
              </div>
            </AdvancedOptionToggle>
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
      <AddNoCodeActionModal
        environmentId={environmentId}
        open={isAddEventModalOpen}
        setOpen={setAddEventModalOpen}
        actionClasses={actionClasses}
        setActionClasses={setActionClasses}
        isViewer={isViewer}
      />
    </>
  );
}
