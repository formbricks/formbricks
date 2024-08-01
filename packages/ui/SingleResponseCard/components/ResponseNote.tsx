"use client";

import clsx from "clsx";
import { CheckIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Maximize2Icon, Minimize2Icon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { timeSince } from "@formbricks/lib/time";
import { TResponseNote } from "@formbricks/types/responses";
import { TUser } from "@formbricks/types/user";
import { Button } from "../../Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../Tooltip";
import { createResponseNoteAction, resolveResponseNoteAction, updateResponseNoteAction } from "../actions";

interface ResponseNotesProps {
  user: TUser;
  responseId: string;
  notes: TResponseNote[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  updateFetchedResponses: () => void;
}

export const ResponseNotes = ({
  user,
  responseId,
  notes,
  isOpen,
  setIsOpen,
  updateFetchedResponses,
}: ResponseNotesProps) => {
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
      await createResponseNoteAction(responseId, user.id, noteText);
      updateFetchedResponses();
      setIsCreatingNote(false);
      setNoteText("");
    } catch (e) {
      toast.error("An error occurred creating a new note");
      setIsCreatingNote(false);
    }
  };

  const handleResolveNote = (note: TResponseNote) => {
    try {
      resolveResponseNoteAction(responseId, note.id);
      // when this was the last note, close the notes panel
      if (unresolvedNotes.length === 1) {
        setIsOpen(false);
      }
      updateFetchedResponses();
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
      updateFetchedResponses();
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
            <div className="flex flex-1 items-center justify-end pr-3">
              <span>
                <PlusIcon className="h-5 w-5 text-slate-400" />
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
                  {user.id === note.user.id && (
                    <button
                      className="ml-auto hidden group-hover/notetext:block"
                      onClick={() => {
                        handleEditPencil(note);
                      }}>
                      <PencilIcon className="h-3 w-3 text-slate-500" />
                    </button>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="ml-2 hidden group-hover/notetext:block"
                          onClick={() => {
                            handleResolveNote(note);
                          }}>
                          <CheckIcon className="h-4 w-4 text-slate-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[45rem] break-all" side="left" sideOffset={5}>
                        <span className="text-slate-700">Resolve</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
          <div
            className={cn(
              "h-[120px] transition-all duration-300",
              !isTextAreaOpen && "pointer-events-none h-14"
            )}>
            <div
              className={clsx(
                "absolute bottom-0 w-full px-3 pb-3",
                !unresolvedNotes.length && "absolute bottom-0"
              )}>
              <form onSubmit={isUpdatingNote ? handleNoteUpdate : handleNoteSubmission}>
                <div className="mt-4">
                  <textarea
                    rows={2}
                    className={cn(
                      "block w-full resize-none rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm",
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
                    className={cn("mr-auto duration-300")}
                    onClick={() => {
                      setIsTextAreaOpen(!isTextAreaOpen);
                    }}>
                    {isTextAreaOpen ? "Hide" : "Show"}
                  </Button>
                  {isTextAreaOpen && (
                    <Button size="sm" type="submit" loading={isCreatingNote}>
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
};
