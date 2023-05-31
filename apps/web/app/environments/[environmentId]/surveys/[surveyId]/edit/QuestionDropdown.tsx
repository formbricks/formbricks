"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@formbricks/ui";
import {
  EllipsisHorizontalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/solid";

interface QuestionDropdownProps {
  questionIdx: number;
  lastQuestion: boolean;
  duplicateQuestion: (questionIdx: number) => void;
  deleteQuestion: (questionIdx: number) => void;
  moveQuestion: (questionIdx: number, up: boolean) => void;
}

export default function QuestionDropdown({
  questionIdx,
  lastQuestion,
  duplicateQuestion,
  deleteQuestion,
  moveQuestion,
}: QuestionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <EllipsisHorizontalIcon className="h-5 w-5 text-slate-600 focus:outline-none active:outline-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          className="justify-between"
          onClick={(e) => {
            e.stopPropagation();
            moveQuestion(questionIdx, true);
          }}
          disabled={questionIdx == 0}>
          Move up <ArrowUpIcon className="ml-3 h-4" />
        </DropdownMenuItem>
        <DropdownMenuItem
          className="justify-between"
          onClick={(e) => {
            e.stopPropagation();
            moveQuestion(questionIdx, false);
          }}
          disabled={lastQuestion}>
          Move down
          <ArrowDownIcon className="h-4" />
        </DropdownMenuItem>
        <DropdownMenuItem
          className="justify-between"
          onClick={(e) => {
            e.stopPropagation();
            duplicateQuestion(questionIdx);
          }}>
          Duplicate <DocumentDuplicateIcon className="ml-3 h-4" />
        </DropdownMenuItem>
        <DropdownMenuItem
          className="justify-between"
          onClick={(e) => {
            e.stopPropagation();
            deleteQuestion(questionIdx);
          }}>
          Delete <TrashIcon className="ml-3 h-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
