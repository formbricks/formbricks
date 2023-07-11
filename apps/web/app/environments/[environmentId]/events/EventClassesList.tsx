"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEventClasses } from "@/lib/eventClasses/eventClasses";
import { timeSinceConditionally } from "@formbricks/lib/time";
import { Button, ErrorComponent } from "@formbricks/ui";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import AddNoCodeEventModal from "./AddNoCodeEventModal";
import EventDetailModal from "./EventDetailModal";

export default function EventClassesList({ environmentId }) {
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses, mutateEventClasses } =
    useEventClasses(environmentId);

  const [isEventDetailModalOpen, setEventDetailModalOpen] = useState(false);
  const [isAddEventModalOpen, setAddEventModalOpen] = useState(false);

  const [activeEventClass, setActiveEventClass] = useState("" as any);

  if (isLoadingEventClasses) {
    return <LoadingSpinner />;
  }

  if (isErrorEventClasses) {
    return <ErrorComponent />;
  }

  const handleOpenEventDetailModalClick = (e, eventClass) => {
    e.preventDefault();
    setActiveEventClass(eventClass);
    setEventDetailModalOpen(true);
  };

  return (
    <>
      <div className="mb-6 text-right">
        <Button
          variant="darkCTA"
          onClick={() => {
            setAddEventModalOpen(true);
          }}>
          <CursorArrowRaysIcon className="mr-2 h-5 w-5 text-white" />
          Add Action
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-6 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <span className="sr-only">Edit</span>
          <div className="col-span-4 pl-6 ">User Actions</div>
          <div className="text-center"># Reps</div>
          <div className="text-center">Created</div>
        </div>
        <div className="grid-cols-7">
          {eventClasses.map((eventClass) => (
            <button
              onClick={(e) => {
                handleOpenEventDetailModalClick(e, eventClass);
              }}
              className="w-full"
              key={eventClass.id}>
              <div className="m-2 grid h-16  grid-cols-6 content-center rounded-lg hover:bg-slate-100">
                <div className="col-span-4 flex items-center pl-6 text-sm">
                  <div className="flex items-center">
                    <div className="h-5 w-5 flex-shrink-0 text-slate-500">
                      {eventClass.type === "code" ? (
                        <CodeBracketIcon />
                      ) : eventClass.type === "noCode" ? (
                        <CursorArrowRaysIcon />
                      ) : eventClass.type === "automatic" ? (
                        <SparklesIcon />
                      ) : null}
                    </div>
                    <div className="ml-4 text-left">
                      <div className="font-medium text-slate-900">{eventClass.name}</div>
                      <div className="text-xs text-slate-400">{eventClass.description}</div>
                    </div>
                  </div>
                </div>
                <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  {eventClass._count?.events}
                </div>
                <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  {timeSinceConditionally(eventClass.createdAt)}
                </div>
                <div className="text-center"></div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <EventDetailModal
        environmentId={environmentId}
        open={isEventDetailModalOpen}
        setOpen={setEventDetailModalOpen}
        eventClass={activeEventClass}
      />
      <AddNoCodeEventModal
        environmentId={environmentId}
        open={isAddEventModalOpen}
        setOpen={setAddEventModalOpen}
        mutateEventClasses={mutateEventClasses}
      />
    </>
  );
}
