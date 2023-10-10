"use client";

import { cn } from "@formbricks/lib/cn";
import * as Collapsible from "@radix-ui/react-collapsible";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";

interface HiddenFieldCardProps {
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
}

export default function HiddenFieldCard({ activeQuestionId, setActiveQuestionId }: HiddenFieldCardProps) {
  const open = activeQuestionId === "end";
  const setOpen = (e) => {
    e ? setActiveQuestionId("end") : setActiveQuestionId(null);
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg" : "scale-97 shadow-md",
        "flex flex-row rounded-lg bg-white transition-all duration-300 ease-in-out"
      )}>
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
            <div>{/*Icons go here */}</div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent></Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
}
