"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { CheckCircleIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

interface AddQuestionButtonProps {
  triggers: any;
  setTriggers: (triggers: any) => void;
  environmentId: string;
}

export default function WhoToSendCard({ environmentId, triggers, setTriggers }: AddQuestionButtonProps) {
  const [open, setOpen] = useState(true);
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses } = useEventClasses(environmentId);

  if (isLoadingEventClasses) {
    return <LoadingSpinner />;
  }

  if (isErrorEventClasses) {
    return <div>Error</div>;
  }

  const addTriggerEvent = () => {
    setTriggers([...triggers, ""]);
  };

  const setTriggerEvent = (idx: number, eventClassId: string) => {
    setTriggers([...triggers.slice(0, idx), eventClassId, ...triggers.slice(idx + 1)]);
  };

  const removeTriggerEvent = (idx: number) => {
    setTriggers([...triggers.slice(0, idx), ...triggers.slice(idx + 1)]);
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full space-y-2 rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pr-5 pl-2">
            {triggers.length === 0 || !triggers[0] ? (
              <div className="h-7 w-7 rounded-full border border-slate-400" />
            ) : (
              <CheckCircleIcon className="h-8 w-8 text-teal-400" />
            )}
          </div>

          <div>
            <p className="text-lg font-semibold text-slate-800">When to send</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              Choose the events when you want the survey to trigger
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="">
        <hr className="py-1 text-slate-600" />
        {triggers.map((triggerEventClassId, idx) => (
          <div className="mt-2">
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
            Add event
          </Button>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
