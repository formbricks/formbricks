"use client";

import AddNoCodeEventModal from "@/app/environments/[environmentId]/events/AddNoCodeEventModal";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@formbricks/ui";
import { CheckCircleIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useState } from "react";

interface WhenToSendCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
}

export default function WhenToSendCard({ environmentId, localSurvey, setLocalSurvey }: WhenToSendCardProps) {
  const [open, setOpen] = useState(localSurvey.type === "web" ? true : false);
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses, mutateEventClasses } =
    useEventClasses(environmentId);
  const [isAddEventModalOpen, setAddEventModalOpen] = useState(false);

  const autoClose = localSurvey.autoClose !== null;

  const addTriggerEvent = () => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers = [...localSurvey.triggers, ""];
    setLocalSurvey(updatedSurvey);
  };

  const setTriggerEvent = (idx: number, eventClassId: string) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers[idx] = eventClassId;
    setLocalSurvey(updatedSurvey);
  };

  const removeTriggerEvent = (idx: number) => {
    const updatedSurvey = { ...localSurvey };
    updatedSurvey.triggers = [...localSurvey.triggers.slice(0, idx), ...localSurvey.triggers.slice(idx + 1)];
    setLocalSurvey(updatedSurvey);
  };

  const handleCheckMark = () => {
    if (autoClose) {
      const updatedSurvey: Survey = { ...localSurvey, autoClose: null };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey: Survey = { ...localSurvey, autoClose: 10 };
      setLocalSurvey(updatedSurvey);
    }
  };

  const handleInputSeconds = (e: any) => {
    let value = parseInt(e.target.value);

    if (value < 1) value = 1;

    const updatedSurvey: Survey = { ...localSurvey, autoClose: value };
    setLocalSurvey(updatedSurvey);
  };

  const handleTriggerDelay = (e: any) => {
    let value = parseInt(e.target.value);
    const updatedSurvey: Survey = { ...localSurvey, delay: value };
    setLocalSurvey(updatedSurvey);
  };

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
  }, []);

  if (isLoadingEventClasses) {
    return <LoadingSpinner />;
  }

  if (isErrorEventClasses) {
    return <div>Error</div>;
  }

  /*   if (localSurvey.type === "link") {
    return null;
  } */

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
              {!localSurvey.triggers ||
              localSurvey.triggers.length === 0 ||
              localSurvey.triggers[0] === "" ? (
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
              <p className="mt-1 truncate text-sm text-slate-500">
                Choose the actions which trigger the survey.
              </p>
            </div>
            {localSurvey.type === "link" && (
              <div className="flex w-full items-center justify-end pr-2">
                <Badge size="normal" text="In-app survey settings" type="warning" />
              </div>
            )}
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="">
          <hr className="py-1 text-slate-600" />
          {localSurvey.triggers?.map((triggerEventClassId, idx) => (
            <div className="mt-2" key={idx}>
              <div className="inline-flex items-center">
                <p className="mr-2 w-14 text-right text-sm">{idx === 0 ? "When" : "or"}</p>
                <Select
                  value={triggerEventClassId}
                  onValueChange={(eventClassId) => setTriggerEvent(idx, eventClassId)}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <button
                      className="flex w-full items-center space-x-2 rounded-md p-1 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-500"
                      value="none"
                      onClick={() => {
                        setAddEventModalOpen(true);
                      }}>
                      <PlusIcon className="mr-1 h-5 w-5" />
                      Add Action
                    </button>
                    <SelectSeparator />
                    {eventClasses.map((eventClass) => (
                      <SelectItem value={eventClass.id} key={eventClass.id}>
                        {eventClass.name}
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
                      className="ml-2 mr-2 inline w-16 text-center text-sm"
                    />
                    seconds before showing the survey.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="ml-2 flex items-center space-x-1 p-4">
            <Switch id="autoClose" checked={autoClose} onCheckedChange={handleCheckMark} />
            <Label htmlFor="autoClose" className="cursor-pointer">
              <div className="ml-2">
                <h3 className="text-sm font-semibold text-slate-700">Auto close on inactivity</h3>
              </div>
            </Label>
          </div>
          {autoClose && (
            <div className="ml-2 flex items-center space-x-1 px-4 pb-4">
              <label
                htmlFor="autoCloseSeconds"
                className="flex w-full cursor-pointer items-center rounded-lg  border bg-slate-50 p-4">
                <div className="">
                  <p className="text-sm font-semibold text-slate-700">
                    Automatically close survey after
                    <Input
                      type="number"
                      min="1"
                      id="autoCloseSeconds"
                      value={localSurvey.autoClose?.toString()}
                      onChange={(e) => handleInputSeconds(e)}
                      className="ml-2 mr-2 inline w-16 text-center text-sm"
                    />
                    seconds with no initial interaction.
                  </p>
                </div>
              </label>
            </div>
          )}
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
      <AddNoCodeEventModal
        environmentId={environmentId}
        open={isAddEventModalOpen}
        setOpen={setAddEventModalOpen}
        mutateEventClasses={mutateEventClasses}
      />
    </>
  );
}
