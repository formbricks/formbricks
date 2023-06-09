"use client";

import { timeSince } from "@formbricks/lib/time";
import { EyeSlashIcon, PlusIcon, EyeIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import toast from "react-hot-toast";
import { useResponses } from "@/lib/responses/responses";
import { Button } from "@formbricks/ui";
import clsx from "clsx";
import { addResponseNote } from "@/lib/responseNote/responsesNote";
import { FormEvent } from "react";
import { OpenTextSummaryProps } from "@/app/environments/[environmentId]/surveys/[surveyId]/responses/SingleResponse";

export default function ResponseNote({ data, environmentId, surveyId, isOpen, setIsOpen }: OpenTextSummaryProps & { isOpen: boolean, setIsOpen: (isOpen: boolean) => void}) {
  const [noteText, setNoteText] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const { mutateResponses } = useResponses(environmentId, surveyId);
  const responseNotes = data?.responseNote;
  const handleNoteSubmission = async (e: FormEvent) => {
    e.preventDefault()
    setIsCreatingNote(true)
    try {
        await addResponseNote(environmentId, surveyId, data?.id, noteText)
        mutateResponses()
        setIsCreatingNote(false)
        setNoteText('')
    } catch (e) {
        toast.error("An error occurred creating a new note");
        setIsCreatingNote(false)
    }
  }

  return (
    <div
        className={clsx(
            "rounded-lg border border-slate-200 shadow-sm absolute transition-all w-1/5 cursor-pointer",
            !isOpen && responseNotes.length && "bg-white",
            !isOpen && !responseNotes.length && "bg-slate-50",
            isOpen ? "w-1/5 top-0 -right-5 h-full bg-white" : "w-1/12 top-[8.333%] right-[120px] group-hover:right-[60px] h-5/6 max-h-[600px]"
        )}
        onClick={() => {
            if(!isOpen) setIsOpen(true)
        }}
    >
        {!isOpen ?
        <div className="flex flex-col h-full">
            <div className={clsx("space-y-2 px-2 pb-2 pt-2 rounded-t-lg", responseNotes.length ? "bg-amber-50 h-16 flex items-center justify-end" : "bg-slate-200")}>
                {!responseNotes.length ? 
                    <div className="flex items-center justify-end">
                        <div className="group flex items-center">
                        <h3 className="ml-4 pb-1 text-slate-600 float-left text-sm">Note</h3>
                        </div>
                    </div> : 
                    <div className="float-left mr-1.5">
                        <EyeIcon className="text-amber-400 w-4 h-4"/>
                    </div>
                }
            </div>
            {!responseNotes.length ? 
                <div className="flex-1  flex justify-end items-center pr-2">
                    <button className="bg-slate-600 w-6 h-6 rounded-full">
                        <span>
                            <PlusIcon className="text-white"/>
                        </span>
                    </button>
                </div> : null}
        </div> :
        <div className="flex flex-col h-full relative">
            <div className="px-4 pb-5 pt-6 bg-amber-50 rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="group flex items-center">
                        <h3 className="pb-1 text-slate-600 text-sm">Note</h3>
                    </div>
                    <div
                        className="w-4 h-4 cursor-pointer"
                        onClick={() => {
                            setIsOpen(!isOpen)
                        }}
                    >
                        <EyeSlashIcon className="text-amber-400"/>
                    </div>
                </div>
            </div>
            <div className="px-4 overflow-auto pt-2 flex-1">
                {responseNotes.map((note) => (
                    <div className="mb-2" key={note.id}>
                        <span className="text-xs text-slate-500 block">
                            {note.user.name} wrote {" "}
                            <time className="text-slate-500" dateTime={timeSince(data.updatedAt)}>
                                ({timeSince(note.updatedAt)})
                            </time>
                        </span>
                        <span className="block text-slate-700">{note.text}</span>
                    </div>
                ))}
            </div>
            <div className="h-[120px]">
                <div className={clsx("w-full px-4 pb-2 absolute bottom-0" , !responseNotes.length && "absolute bottom-0")}>
                    <form onSubmit={handleNoteSubmission}>
                        <div className="mt-4">
                            <textarea
                                rows={2}
                                className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm resize-none"
                                onChange={(e) => setNoteText(e.target.value)}
                                value={noteText}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && noteText) {
                                        e.preventDefault()
                                        handleNoteSubmission(e)
                                    }
                                }}
                                required
                            >
                            </textarea>
                        </div>
                        <div className="mt-4 flex w-full justify-end">
                            <Button className="bg-slate-600 hover:bg-slate-400" size="sm" type="submit" loading={isCreatingNote}>Send</Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>}
    </div>
  );
}
