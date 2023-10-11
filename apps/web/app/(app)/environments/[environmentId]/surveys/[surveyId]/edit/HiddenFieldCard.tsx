"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import * as Collapsible from "@radix-ui/react-collapsible";
import { EyeIcon, EyeSlashIcon, TrashIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";

interface HiddenFieldCardProps {
  localSurvey: TSurveyWithAnalytics;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export default function HiddenFieldCard({
  localSurvey,
  activeQuestionId,
  setActiveQuestionId,
}: HiddenFieldCardProps) {
  const [display, setDisplay] = useState("flex");
  const [hiddenFields, setHiddenFields] = useState<any[]>([]);
  const [showHiddenInput, setShowHiddenInput] = useState(false);
  const [inputID, setInputID] = useState("Type to add a hidden field...");
  const open = activeQuestionId === "end";
  const setOpen = (e) => {
    e ? setActiveQuestionId("end") : setActiveQuestionId(null);
  };
  let index = 0;

  const handleKeyDown = (e) => {
    if (e.key == " ") {
      toast.error("Spaces not allowed in ID");
    }

    if (e.key == "Enter") {
      if (inputID.length < 6) {
        toast.error("ID must be at least 6 characters");
      }
      localSurvey.questions.forEach((question) => {
        if (question.id == inputID) {
          toast.error("ID must not be equal to questionsID");
        }
      });

      index++;

      let newField = <HiddenFieldBubble hiddenInputID={inputID} bubbleIndex={index} />;

      setHiddenFields([...hiddenFields, newField]);
    }
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg" : "scale-97 shadow-md",
        display,
        "mt-5 flex rounded-lg bg-white transition-all duration-300 ease-in-out"
      )}>
      <div
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "flex w-10 items-center justify-center rounded-l-lg hover:bg-slate-600 group-aria-expanded:rounded-bl-none"
        )}>
        <EyeIcon className="h-4 bg-white" />
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 
                 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex flex-1 items-center">
              <EyeSlashIcon className="h-4 bg-slate-500" />
              <p className="text-sm font-semibold">Hidden fields</p>
            </div>
            <TrashIcon
              className="h-4 cursor-pointer text-slate-500 hover:text-slate-600"
              onChange={(e) => {
                e.preventDefault();
                setDisplay("hidden");
              }}
            />
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="relative flex justify-evenly px-4 pb-6">
          <div className="flex flex-1 flex-wrap justify-evenly p-2 md:flex-nowrap">
            {hiddenFields ? hiddenFields : <p className="text-sm text-slate-400">No hidden fields yet</p>}
          </div>
          <button
            className="rounded-md bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-2
              text-sm font-medium leading-4 text-white"
            onClick={(e) => {
              e.preventDefault();
              setShowHiddenInput(!showHiddenInput);
            }}>
            Add Field
          </button>
          {showHiddenInput && (
            <input
              className="focus:border-brand absolute -bottom-3 right-2 flex h-10 w-28 rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 shadow-lg placeholder:text-slate-400 focus:outline-none  focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
              name="hiddenInput"
              defaultValue={inputID}
              onChange={(e) => {
                setInputID(e.target.value);
              }}
              onKeyDown={handleKeyDown}
            />
          )}
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
}

interface HiddenFieldBubbleProps {
  hiddenInputID: string | null;
  bubbleIndex: number;
}

/* This component renders a ui element each time an ID is added via the input element */
const HiddenFieldBubble = ({ hiddenInputID, bubbleIndex }: HiddenFieldBubbleProps) => {
  const id = hiddenInputID;

  return (
    <div className="flex h-10 w-10 items-center justify-evenly rounded-lg bg-slate-500">
      <p className="text-xs font-medium text-white">{`hidden field ${bubbleIndex}`}</p>
      <XCircleIcon className="h-4 bg-white text-slate-500" />
    </div>
  );
};
