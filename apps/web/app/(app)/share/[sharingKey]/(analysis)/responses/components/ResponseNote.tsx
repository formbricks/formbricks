"use client";

import { cn } from "@formbricks/lib/cn";
import { timeSince } from "@formbricks/lib/time";
import { TResponseNote } from "@formbricks/types/responses";
import { PlusIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { Maximize2Icon, Minimize2Icon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

interface ResponseNotesProps {
  responseId: string;
  notes: TResponseNote[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function ResponseNotes({ responseId, notes, isOpen, setIsOpen }: ResponseNotesProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divRef.current) {
      divRef.current.scrollTop = divRef.current.scrollHeight;
    }
  }, [notes]);

  const unresolvedNotes = useMemo(() => notes.filter((note) => !note.isResolved), [notes]);

  return (
    <div
      className={clsx(
        "absolute w-1/4 rounded-lg border border-slate-200 shadow-sm transition-all",
        !isOpen && unresolvedNotes.length && "group/hint cursor-pointer bg-white hover:-right-3",
        !isOpen && !unresolvedNotes.length && "cursor-pointer bg-slate-50",
        isOpen
          ? "-right-5 top-0 h-5/6 max-h-[600px] w-1/4 bg-white"
          : unresolvedNotes.length
          ? "right-0 top-[8.33%] h-5/6 max-h-[600px] w-1/12"
          : "right-[120px] top-[8.333%] h-5/6 max-h-[600px] w-1/12 group-hover:right-[0]"
      )}
      onClick={() => {
        if (!isOpen) setIsOpen(true);
      }}>
      {!isOpen ? (
        <div className="flex h-full flex-col">
          <div
            className={clsx(
              "space-y-2 rounded-t-lg px-2 pb-2 pt-2",
              unresolvedNotes.length ? "flex h-12 items-center justify-end bg-amber-50" : "bg-slate-200"
            )}>
            {!unresolvedNotes.length ? (
              <div className="flex items-center justify-end">
                <div className="group flex items-center">
                  <h3 className="float-left ml-4 pb-1 text-sm text-slate-600">Note</h3>
                </div>
              </div>
            ) : (
              <div className="float-left mr-1.5">
                <Maximize2Icon className="h-4 w-4 text-amber-500 hover:text-amber-600 group-hover/hint:scale-110" />
              </div>
            )}
          </div>
          {!unresolvedNotes.length ? (
            <div className="flex  flex-1 items-center justify-end pr-3">
              <span>
                <PlusIcon className=" h-5 w-5 text-slate-400" />
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative flex h-full flex-col">
          <div className="rounded-t-lg bg-amber-50 px-4 pb-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="group flex items-center">
                <h3 className="pb-1 text-sm text-amber-500">Note</h3>
              </div>
              <button
                className="h-6 w-6 cursor-pointer"
                onClick={() => {
                  setIsOpen(!isOpen);
                }}>
                <Minimize2Icon className="h-5 w-5 text-amber-500 hover:text-amber-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-4 pt-2" ref={divRef}>
            {unresolvedNotes.map((note) => (
              <div className="group/notetext mb-3" key={note.id}>
                <span className="block font-semibold text-slate-700">
                  {note.user.name}
                  <time
                    className="ml-2 text-xs font-normal text-slate-500"
                    dateTime={timeSince(note.updatedAt.toISOString())}>
                    {timeSince(note.updatedAt.toISOString())}
                  </time>
                  {note.isEdited && (
                    <span className="ml-1 text-[12px] font-normal text-slate-500">{"(edited)"}</span>
                  )}
                </span>
                <div className="flex items-center">
                  <span className="block text-slate-700">{note.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={cn("h-[120px] transition-all duration-300")}>
            <div
              className={clsx(
                "absolute bottom-0 w-full px-3 pb-3",
                !unresolvedNotes.length && "absolute bottom-0"
              )}></div>
          </div>
        </div>
      )}
    </div>
  );
}
