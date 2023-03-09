"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { useEventClasses } from "@/lib/eventClasses";
import { timeSinceConditionally } from "@/lib/time";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/20/solid";
import Link from "next/link";

export default function EventClassesList({ environmentId }) {
  const { eventClasses, isLoadingEventClasses, isErrorEventClasses } = useEventClasses(environmentId);

  if (isLoadingEventClasses) {
    return <LoadingSpinner />;
  }

  if (isErrorEventClasses) {
    return <div>Error</div>;
  }
  return (
    <>
      <div className="mb-6 text-right">
        <Button variant="primary">Add event</Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-gray-900">
          <div className="col-span-4 pl-6 ">Name</div>
          <div className="text-center"># events</div>
          <div className="text-center">Created</div>
          <div className="text-center">
            <span className="sr-only">Edit</span>
          </div>
        </div>
        <div className="grid-cols-7">
          {eventClasses.map((eventClass) => (
            <Link href="/" className="w-full">
              <div
                key={eventClass.id}
                className="m-2 grid h-16  grid-cols-7 content-center rounded-lg hover:bg-slate-100">
                <div className="col-span-4 flex items-center pl-6 text-sm">
                  <div className="flex items-center">
                    <div className="h-5 w-5 flex-shrink-0 text-slate-300">
                      {eventClass.type === "code" ? (
                        <CodeBracketIcon />
                      ) : eventClass.type === "noCode" ? (
                        <CursorArrowRaysIcon />
                      ) : eventClass.type === "automatic" ? (
                        <SparklesIcon />
                      ) : null}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-900">{eventClass.name}</div>
                      <div className="text-gray-500">{eventClass.description}</div>
                    </div>
                  </div>
                </div>
                <div className="my-auto whitespace-nowrap text-center text-sm text-gray-500">
                  {eventClass._count?.events}
                </div>
                <div className="my-auto whitespace-nowrap text-center text-sm text-gray-500">
                  {timeSinceConditionally(eventClass.createdAt)}
                </div>
                <div>
                  {eventClass.type !== "automatic" && (
                    <a href="#" className="text-brand-dark hover:text-brand">
                      Edit<span className="sr-only">, {eventClass.name}</span>
                    </a>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
