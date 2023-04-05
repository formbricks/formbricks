"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { cn } from "@formbricks/lib/cn";
import type { Survey } from "@formbricks/types/surveys";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui";
import { CheckCircleIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import AddNoCodeEventModal from "../../../events/AddNoCodeEventModal";

interface WhenToSendCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
  environmentId: string;
}

export default function WhenToSendCard({ environmentId, localSurvey, setLocalSurvey }: WhenToSendCardProps) {
  const [open, setOpen] = useState(false);
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses, mutateEventClasses } =
    useEventClasses(environmentId);
  const [isAddEventModalOpen, setAddEventModalOpen] = useState(false);

  if (isLoadingEventClasses) {
    return <LoadingSpinner />;
  }

  if (isErrorEventClasses) {
    return <div>Error</div>;
  }

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

  /*      // If there are no trigger events, set default to first event class in the eventClasses object
  if (localSurvey.triggers.length === 0 && eventClasses.length > 0) {
    setTriggerEvent(0, eventClasses[0].id);
  }  */

  return (
    <>
      {" "}
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className={cn(
          open ? "" : "hover:bg-slate-50",
          "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
        )}>
        <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
          <div className="inline-flex px-4 py-6">
            <div className="flex items-center pr-5 pl-2">
              {localSurvey.triggers.length === 0 || !localSurvey.triggers[0] ? (
                <div className="h-7 w-7 rounded-full border border-slate-400" />
              ) : (
                <CheckCircleIcon className="h-8 w-8 text-green-400" />
              )}
            </div>

            <div>
              <p className="font-semibold text-slate-800">When to ask</p>
              <p className="mt-1 truncate text-sm text-slate-500">
                Choose the events which trigger the survey.
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
                    {eventClasses.map((eventClass) => (
                      <SelectItem value={eventClass.id}>{eventClass.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mx-2 text-sm">event is triggered</p>
                <button onClick={() => removeTriggerEvent(idx)}>
                  <TrashIcon className="ml-3 h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
          <div className="p-3">
            <Button
              variant="secondary"
              onClick={() => {
                addTriggerEvent();
              }}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add condition
            </Button>
            <Button
              variant="minimal"
              onClick={() => {
                setAddEventModalOpen(true);
              }}>
              Create event
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
