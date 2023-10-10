"use client";

import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { Input } from "@formbricks/ui";
import * as Collapsible from "@radix-ui/react-collapsible";
import { EyeIcon, EyeSlashIcon, TrashIcon } from "@heroicons/react/24/solid";

interface HiddenFieldCardProps {
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export default function HiddenFieldCard({ activeQuestionId, setActiveQuestionId }: HiddenFieldCardProps) {
  const [display, setDisplay] = useState("flex");
  const [hiddenFields, setHiddenFields] = useState([]);
  const [showHiddenInput, setShowHiddenInput] = useState(false);
  const [inputID, setInputID] = useState("Type to add a hidden field");
  const open = activeQuestionId === "end";
  const setOpen = (e) => {
    e ? setActiveQuestionId("end") : setActiveQuestionId(null);
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg" : "scale-97 shadow-md",
        "flex-row rounded-lg bg-white transition-all duration-300 ease-in-out"
      )}
      style={{
        display: display,
      }}>
      <div
        className={cn(
          open ? "bg-slate-700" : "bg-slate-400",
          "flex w-10 items-center justify-center rounded-l-lg hover:bg-slate-600 group-aria-expanded:rounded-bl-none"
        )}>
        <EyeIcon />
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
            <div className="inline-flex">
              <EyeSlashIcon />
              <p className="text-sm font-semibold">Hidden fields</p>
            </div>
            <TrashIcon
              className="h-4 cursor-pointer text-slate-500 hover:text-slate-600"
              onChange={(e) => {
                e.preventDefault();
                setDisplay("none");
              }}
            />
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="relative flex justify-evenly px-4 pb-6">
          <div className="flex w-4/6 justify-evenly">
            {hiddenFields ? hiddenFields : <p className="text-sm text-slate-400">No hidden fields yet</p>}
          </div>
          <button
            className="rounded-md bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-2
              text-sm font-medium leading-4"
            onClick={(e) => {
              e.preventDefault();
              setShowHiddenInput(!showHiddenInput);
            }}>
            Add field
          </button>
          {showHiddenInput && (
            <Input
              id="hiddenInput"
              name="hiddenInput"
              defaultValue={inputID}
              onChange={(e) => {
                setInputID(e.target.value);
              }}
            />
          )}
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
}
