"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@formbricks/ui";
import { EllipsisHorizontalIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";

interface QuestionDropdownProps {
  questionIdx: number;
  lastQuestion: boolean;
  deleteQuestion: (questionIdx: number) => void;
  moveQuestion: (questionIdx: number, up: boolean) => void;
}

export default function QuestionDropdown({
  questionIdx,
  lastQuestion,
  deleteQuestion,
  moveQuestion,
}: QuestionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <EllipsisHorizontalIcon className="h-5 w-5 text-slate-600 focus:outline-none active:outline-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => deleteQuestion(questionIdx)}>Delete</DropdownMenuItem>
        <DropdownMenuItem
          className="justify-end"
          onClick={() => moveQuestion(questionIdx, true)}
          disabled={questionIdx == 0}>
          <ArrowUpIcon className="h-5" />
        </DropdownMenuItem>
        <DropdownMenuItem
          className="justify-end"
          onClick={() => moveQuestion(questionIdx, false)}
          disabled={lastQuestion}>
          <ArrowDownIcon className="h-5" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
