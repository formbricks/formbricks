"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@formbricks/ui";
import { CheckCircleIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useState } from "react";
import AddNoCodeEventModal from "../../../events/AddNoCodeEventModal";

interface WhenToSendCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
}

export default function WhenToSendCard({ environmentId, localSurvey, setLocalSurvey }: WhenToSendCardProps) {
  const [open, setOpen] = useState(true);
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses, mutateEventClasses } =
    useEventClasses(environmentId);
  const [isAddEventModalOpen, setAddEventModalOpen] = useState(false);

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

  if (localSurvey.type === "link") {
    return null;
  }

  return (
    <>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className={cn(
          open ? "" : "hover:bg-slate-50",
          "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
        )}>
        <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
          <div className="inline-flex px-4 py-6">
            <div className="flex items-center pl-2 pr-5">
              {localSurvey.triggers.length === 0 || !localSurvey.triggers[0] ? (
                <div className="h-7 w-7 rounded-full border border-slate-400" />
              ) : (
                <CheckCircleIcon className="h-8 w-8 text-green-400" />
              )}
            </div>

            <div>
              <p className="font-semibold text-slate-800">When to ask</p>
              <p className="mt-1 truncate text-sm text-slate-500">
                Choose the actions which trigger the survey.
              </p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="">
          <hr className="py-1 text-slate-600" />
          {localSurvey.triggers.map((triggerEventClassId, idx) => (
            <div className="mt-2" key={idx}>
              <div className="inline-flex items-center">
                <p className="mr-2 w-14 text-right text-sm">{idx === 0 ? "When" : "or"}</p>
                <Select
                  value={triggerEventClassId}
                  onValueChange={(eventClassId) => setTriggerEvent(idx, eventClassId)}>
                  <SelectTrigger className="w-[180px]">
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
                      <SelectItem value={eventClass.id}>{eventClass.name}</SelectItem>
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
          <div className="ml-14 p-3">
            <Button
              variant="secondary"
              onClick={() => {
                addTriggerEvent();
              }}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add condition
            </Button>
          </div>
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
