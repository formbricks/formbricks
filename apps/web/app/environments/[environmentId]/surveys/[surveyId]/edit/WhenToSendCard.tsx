"use client";

import { Bars4Icon, ClockIcon } from "@heroicons/react/20/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

const questionTypes = [
  {
    id: "openText",
    label: "Open Text",
    icon: Bars4Icon,
  },
];

interface AddQuestionButtonProps {
  addQuestion: (question: any) => void;
}

export default function WhenToSendCard({}: AddQuestionButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full space-y-2 rounded-lg border border-dashed border-gray-300">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full">
        <div className="inline-flex p-4">
          <ClockIcon className="-ml-0.5 mr-1 h-5 w-5 text-slate-400" />
          <div>
            <p className="text-sm font-semibold">When to send</p>
            <p className="mt-1 truncate text-sm text-gray-500">Add a new question to your survey</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="justify-left flex flex-col">
        <hr className="py-1 text-slate-600" />
        {questionTypes.map((questionType) => (
          <button
            key={questionType.id}
            className="inline-flex items-center py-2 px-4 text-sm font-medium hover:bg-gray-100"
            onClick={() => {
              setOpen(false);
            }}>
            <questionType.icon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
            {questionType.label}
          </button>
        ))}
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
