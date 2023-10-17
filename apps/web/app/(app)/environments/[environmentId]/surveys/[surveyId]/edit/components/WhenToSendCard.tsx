"use client";

import AddNoCodeActionModal from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/components/AddNoCodeActionModal";
import { cn } from "@formbricks/lib/cn";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Badge } from "@formbricks/ui/Badge";
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
import { CheckCircleIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useCallback, useEffect, useState } from "react";
interface WhenToSendCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  environmentId: string;
  actionClasses: TActionClass[];
}

export default function WhenToSendCard({
  environmentId,
  localSurvey,
  setLocalSurvey,
  actionClasses,
}: WhenToSendCardProps) {
  const [open, setOpen] = useState(localSurvey.type === "web" ? true : false);
  const [isAddEventModalOpen, setAddEventModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [actionClassArray, setActionClassArray] = useState<TActionClass[]>(actionClasses);

  const autoClose = localSurvey.autoClose !== null;

  const addTriggerEvent = useCallback(() => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers = [...localSurvey.triggers, ""];
    setLocalSurvey(updatedSurvey);
  }, [localSurvey, setLocalSurvey]);

  const setTriggerEvent = useCallback(
    (idx: number, actionClassName: string) => {
      const updatedSurvey = { ...localSurvey };
      const newActionClass = actionClassArray!.find((actionClass) => {
        return actionClass.name === actionClassName;
      });
      if (!newActionClass) {
        throw new Error("Action class not found");
      }
      updatedSurvey.triggers[idx] = newActionClass.name;
      setLocalSurvey(updatedSurvey);
    },
    [actionClassArray, localSurvey, setLocalSurvey]
  );

  const removeTriggerEvent = (idx: number) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers = [...localSurvey.triggers.slice(0, idx), ...localSurvey.triggers.slice(idx + 1)];
    setLocalSurvey(updatedSurvey);
  };

  const handleCheckMark = () => {
    if (autoClose) {
      const updatedSurvey = { ...localSurvey, autoClose: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey = { ...localSurvey, autoClose: 10 };
      setLocalSurvey(updatedSurvey);
    }
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

  useEffect(() => {
    if (activeIndex !== null) {
      const newActionClass = actionClassArray[actionClassArray.length - 1].name;
      const currentActionClass = localSurvey.triggers[activeIndex];

      if (newActionClass !== currentActionClass) {
        setTriggerEvent(activeIndex, newActionClass);
      }

      setActiveIndex(null);
    }
  }, [actionClassArray, activeIndex, setTriggerEvent]);

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
          className={cn(
            localSurvey.type !== "link"
              ? "cursor-pointer hover:bg-slate-50"
              : "cursor-not-allowed bg-slate-50",
            "h-full w-full rounded-lg "
          )}>
          <div className="inline-flex px-4 py-4">
            <div className="flex items-center pl-2 pr-5">
              {!localSurvey.triggers || localSurvey.triggers.length === 0 || !localSurvey.triggers[0] ? (
                <div
                  className={cn(
                    localSurvey.type !== "link"
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-300 bg-slate-100",
                    "h-7 w-7 rounded-full border "
                  )}
                />
              ) : (
                <CheckCircleIcon
                  className={cn(
                    localSurvey.type !== "link" ? "text-green-400" : "text-slate-300",
                    "h-8 w-8 "
                  )}
                />
              )}
            </div>

            <div>
              <p className="font-semibold text-slate-800">Survey Trigger</p>
              <p className="mt-1 text-sm text-slate-500">Choose the actions which trigger the survey.</p>
            </div>
            {localSurvey.type === "link" && (
              <div className="flex w-full items-center justify-end pr-2">
                <Badge size="normal" text="In-app survey settings" type="gray" />
              </div>
            )}
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="">
          <hr className="py-1 text-slate-600" />
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
                      {actionClassArray.map((actionClass) => (
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
                  <button onClick={() => removeTriggerEvent(idx)}>
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

          {localSurvey.type !== "link" && (
            <div className="ml-2 flex items-center space-x-1 px-4 pb-4">
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
            </div>
          )}

          <AdvancedOptionToggle
            htmlId="autoClose"
            isChecked={autoClose}
            onToggle={handleCheckMark}
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
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
      <AddNoCodeActionModal
        environmentId={environmentId}
        open={isAddEventModalOpen}
        setOpen={setAddEventModalOpen}
        setActionClassArray={setActionClassArray}
      />
    </>
  );
}
