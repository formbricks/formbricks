"use client";

import {
  resolveResponseNoteAction,
  updateResponseNoteAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/actions";
import { useProfile } from "@/lib/profile";
import { addResponseNote } from "@/lib/responseNotes/responsesNotes";
import { cn } from "@formbricks/lib/cn";
import { timeSince } from "@formbricks/lib/time";
import { TResponseNote } from "@formbricks/types/v1/responses";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";
import { CheckIcon, PencilIcon, PlusIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { Maximize2Icon, Minimize2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

interface ResponseNotesProps {
  responseId: string;
  notes: TResponseNote[];
  environmentId: string;
  surveyId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function ResponseNotes({
  responseId,
  notes,
  environmentId,
  surveyId,
  isOpen,
  setIsOpen,
}: ResponseNotesProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [noteText, setNoteText] = useState("");
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [isTextAreaOpen, setIsTextAreaOpen] = useState(true);
  const [noteId, setNoteId] = useState("");
  const divRef = useRef<HTMLDivElement>(null);

  const handleNoteSubmission = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreatingNote(true);
    try {
      await addResponseNote(environmentId, surveyId, responseId, noteText);
      router.refresh();
      setIsCreatingNote(false);
      setNoteText("");
    } catch (e) {
      toast.error("An error occurred creating a new note");
      setIsCreatingNote(false);
    }
  };

  const handleResolveNote = (note: TResponseNote) => {
    try {
      resolveResponseNoteAction(note.id);
      router.refresh();
    } catch (e) {
      toast.error("An error occurred resolving a note");
      setIsUpdatingNote(false);
    }
  };

  const handleEditPencil = (note: TResponseNote) => {
    setIsTextAreaOpen(true);
    setNoteText(note.text);
    setIsUpdatingNote(true);
    setNoteId(note.id);
  };

  const handleNoteUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdatingNote(true);
    try {
      await updateResponseNoteAction(noteId, noteText);
      router.refresh();
      setIsUpdatingNote(false);
      setNoteText("");
    } catch (e) {
      toast.error("An error occurred updating a note");
      setIsUpdatingNote(false);
    }
  };

  useEffect(() => {
    if (divRef.current) {
      divRef.current.scrollTop = divRef.current.scrollHeight;
    }
  }, [notes]);

  return (
    <div
      className={clsx(
        "absolute w-1/4 rounded-lg border border-slate-200 shadow-sm transition-all",
        !isOpen && notes.length && "group/hint cursor-pointer bg-white hover:-right-3",
        !isOpen && !notes.length && "cursor-pointer bg-slate-50",
        isOpen
          ? "-right-5 top-0 h-5/6 max-h-[600px] w-1/4 bg-white"
          : notes.length
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
              notes.length ? "flex h-12 items-center justify-end bg-amber-50" : "bg-slate-200"
            )}>
            {!notes.length ? (
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
          {!notes.length ? (
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
            {notes
              .filter((note) => !note.isResolved)
              .map((note) => (
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
                    {profile.id === note.user.id && (
                      <button
                        className="ml-auto hidden group-hover/notetext:block"
                        onClick={() => {
                          handleEditPencil(note);
                        }}>
                        <PencilIcon className="h-3 w-3 text-gray-500" />
                      </button>
                    )}
                    {!note.isResolved && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="ml-2 hidden group-hover/notetext:block"
                              onClick={() => {
                                handleResolveNote(note);
                              }}>
                              <CheckIcon className="h-4 w-4 text-gray-500" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[45rem] break-all" side="left" sideOffset={5}>
                            <span className="text-slate-700">Resolve</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              ))}
          </div>
          <div
            className={cn(
              "h-[120px] transition-all duration-300",
              !isTextAreaOpen && "pointer-events-none h-14"
            )}>
            <div className={clsx("absolute bottom-0 w-full px-3 pb-3", !notes.length && "absolute bottom-0")}>
              <form onSubmit={isUpdatingNote ? handleNoteUpdate : handleNoteSubmission}>
                <div className="mt-4">
                  <textarea
                    rows={2}
                    className={cn(
                      "block w-full resize-none rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm  focus:border-slate-500 focus:ring-0 sm:text-sm",
                      !isTextAreaOpen && "scale-y-0 transition-all duration-1000",
                      !isTextAreaOpen && "translate-y-8 transition-all duration-300",
                      isTextAreaOpen && "scale-y-1 transition-all duration-1000",
                      isTextAreaOpen && "translate-y-0 transition-all duration-300"
                    )}
                    onChange={(e) => setNoteText(e.target.value)}
                    value={noteText}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && noteText) {
                        e.preventDefault();
                        {
                          isUpdatingNote ? handleNoteUpdate(e) : handleNoteSubmission(e);
                        }
                      }
                    }}
                    required></textarea>
                </div>
                <div className="pointer-events-auto z-10 mt-2 flex w-full items-center justify-end">
                  <Button
                    variant="minimal"
                    type="button"
                    size="sm"
                    className={cn("mr-auto duration-300 ")}
                    onClick={() => {
                      setIsTextAreaOpen(!isTextAreaOpen);
                    }}>
                    {isTextAreaOpen ? "Hide" : "Show"}
                  </Button>
                  {isTextAreaOpen && (
                    <Button variant="darkCTA" size="sm" type="submit" loading={isCreatingNote}>
                      {isUpdatingNote ? "Save" : "Send"}
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
