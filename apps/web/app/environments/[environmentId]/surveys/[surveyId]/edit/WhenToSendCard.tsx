"use client";

import Button from "@/components/ui/Button";
import { ClockIcon, TrashIcon } from "@heroicons/react/20/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";

interface AddQuestionButtonProps {
  triggers: any;
  setTriggers: (triggers: any) => void;
  environmentId: string;
}

export default function WhenToSendCard({ environmentId, triggers, setTriggers }: AddQuestionButtonProps) {
  const [open, setOpen] = useState(true);
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses } = useEventClasses(environmentId);

  if (isLoadingEventClasses) {
    return <div>Loading</div>;
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
      className="w-full space-y-2 rounded-lg border border-gray-300">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full">
        <div className="inline-flex p-4">
          <ClockIcon className="-ml-0.5 mr-1 h-5 w-5 text-slate-400" />
          <div>
            <p className="text-sm font-semibold">When to send</p>
            <p className="mt-1 truncate text-sm text-gray-500">
              Choose the moment when you want the survey to trigger
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
            Add event
          </Button>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
