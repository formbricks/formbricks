"use client";

import { getQuestionDefaults, questionTypes, universalQuestionDefaults } from "@/lib/questions";
import { PlusIcon } from "@heroicons/react/24/solid";
import { createId } from "@paralleldrive/cuid2";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

interface AddQuestionButtonProps {
  addQuestion: (question: any) => void;
}

export default function AddQuestionButton({ addQuestion }: AddQuestionButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className=" w-full space-y-2 rounded-lg border border-dashed border-slate-300 bg-white hover:cursor-pointer">
      <Collapsible.CollapsibleTrigger asChild className="group h-full w-full">
        <div className="inline-flex">
          <div className="bg-brand-dark flex w-10 items-center justify-center rounded-l-lg group-aria-expanded:rounded-bl-none">
            <PlusIcon className="h-6 w-6 text-white" />
          </div>
          <div className="px-4 py-3">
            <p className="font-semibold">Add Question</p>
            <p className="mt-1 truncate text-sm text-slate-500">Add a new question to your survey</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="justify-left flex flex-col ">
        {/* <hr className="py-1 text-slate-600" /> */}
        {questionTypes.map((questionType) => (
          <button
            key={questionType.id}
            className="inline-flex items-center py-2 px-4 text-sm font-medium text-slate-700 last:mb-2 hover:bg-slate-100"
            onClick={() => {
              addQuestion({
                id: createId(),
                type: questionType.id,
                ...universalQuestionDefaults,
                ...getQuestionDefaults(questionType.id),
              });
              setOpen(false);
            }}>
            <questionType.icon className="text-brand-dark -ml-0.5 mr-2 h-5 w-5" aria-hidden="true" />
            {questionType.label}
          </button>
        ))}
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
