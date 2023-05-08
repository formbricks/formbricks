"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/solid";

interface QuestionDropdownProps {
  questionIdx: number;
  deleteQuestion: (questionIdx: number) => void;
}

export default function QuestionDropdown({ questionIdx, deleteQuestion }: QuestionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <EllipsisHorizontalIcon className="h-5 w-5 text-slate-600 focus:outline-none active:outline-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => deleteQuestion(questionIdx)}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
