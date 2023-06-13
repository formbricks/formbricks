"use client";

import { OpenTextSummaryProps } from "@/app/environments/[environmentId]/surveys/[surveyId]/responses/SingleResponse";
import { addResponseNote } from "@/lib/responseNotes/responsesNotes";
import { useResponses } from "@/lib/responses/responses";
import { timeSince } from "@formbricks/lib/time";
import { Button } from "@formbricks/ui";
import { PlusIcon } from "@heroicons/react/24/outline";
import { MinusIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { Maximize2Icon } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function ResponseNote({
  data,
  environmentId,
  surveyId,
  isOpen,
  setIsOpen,
}: OpenTextSummaryProps & { isOpen: boolean; setIsOpen: (isOpen: boolean) => void }) {
  const [noteText, setNoteText] = useState("");
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const { mutateResponses } = useResponses(environmentId, surveyId);
  const responseNotes = data?.responseNotes;
  const divRef = useRef<HTMLDivElement>(null);

  const handleNoteSubmission = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreatingNote(true);
    try {
      await addResponseNote(environmentId, surveyId, data?.id, noteText);
      mutateResponses();
      setIsCreatingNote(false);
      setNoteText("");
    } catch (e) {
      toast.error("An error occurred creating a new note");
      setIsCreatingNote(false);
    }
  };

  useEffect(() => {
    if (divRef.current) {
      divRef.current.scrollTop = divRef.current.scrollHeight;
    }
  }, [responseNotes]);

  return (
    <div
      className={clsx(
        "absolute w-1/4 rounded-lg border border-slate-200 shadow-sm transition-all",
        !isOpen && responseNotes.length && "group/hint cursor-pointer bg-white hover:-right-3",
        !isOpen && !responseNotes.length && "cursor-pointer bg-slate-50",
        isOpen
          ? "-right-5 top-0 h-full w-1/5 bg-white"
          : responseNotes.length
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
              responseNotes.length ? "flex h-12 items-center justify-end bg-amber-50" : "bg-slate-200"
            )}>
            {!responseNotes.length ? (
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
          {!responseNotes.length ? (
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
                <h3 className="pb-1 text-sm text-slate-500">Note</h3>
              </div>
              <button
                className="h-6 w-6 cursor-pointer"
                onClick={() => {
                  setIsOpen(!isOpen);
                }}>
                <MinusIcon className="h-5 w-5 text-amber-500 hover:text-amber-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-4 pt-2" ref={divRef}>
            {responseNotes.map((note) => (
              <div className="mb-3" key={note.id}>
                <span className="block font-semibold text-slate-700">
                  {note.user.name}
                  <time
                    className="ml-2 text-xs font-normal text-slate-500"
                    dateTime={timeSince(data.updatedAt)}>
                    {timeSince(note.updatedAt)}
                  </time>
                </span>
                <span className="block text-slate-700">{note.text}</span>
              </div>
            ))}
          </div>
          <div className="h-[120px]">
            <div
              className={clsx(
                "absolute bottom-0 w-full px-3 pb-3",
                !responseNotes.length && "absolute bottom-0"
              )}>
              <form onSubmit={handleNoteSubmission}>
                <div className="mt-4">
                  <textarea
                    rows={2}
                    className="block w-full resize-none rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm"
                    onChange={(e) => setNoteText(e.target.value)}
                    value={noteText}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && noteText) {
                        e.preventDefault();
                        handleNoteSubmission(e);
                      }
                    }}
                    required></textarea>
                </div>
                <div className="mt-2 flex w-full justify-end">
                  <Button variant="darkCTA" size="sm" type="submit" loading={isCreatingNote}>
                    Send
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
