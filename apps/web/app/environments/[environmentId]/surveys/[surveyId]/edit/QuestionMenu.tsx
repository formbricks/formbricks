"use client";

import { ArrowUpIcon, ArrowDownIcon, TrashIcon, DocumentDuplicateIcon } from "@heroicons/react/24/solid";

interface QuestionDropdownProps {
  questionIdx: number;
  lastQuestion: boolean;
  duplicateQuestion: (questionIdx: number) => void;
  deleteQuestion: (questionIdx: number) => void;
  moveQuestion: (questionIdx: number, up: boolean) => void;
}

export default function QuestionActions({
  questionIdx,
  lastQuestion,
  duplicateQuestion,
  deleteQuestion,
  moveQuestion,
}: QuestionDropdownProps) {
  return (
    <div className="flex space-x-4">
      <ArrowUpIcon
        className={`h-4 cursor-pointer text-slate-500 hover:text-slate-600 ${
          questionIdx === 0 ? "opacity-50" : ""
        }`}
        onClick={(e) => {
          if (questionIdx !== 0) {
            e.stopPropagation();
            moveQuestion(questionIdx, true);
          }
        }}
      />
      <ArrowDownIcon
        className={`h-4 cursor-pointer text-slate-500 hover:text-slate-600 ${
          lastQuestion ? "opacity-50" : ""
        }`}
        onClick={(e) => {
          if (!lastQuestion) {
            e.stopPropagation();
            moveQuestion(questionIdx, false);
          }
        }}
      />
      <DocumentDuplicateIcon
        className="h-4 cursor-pointer text-slate-500 hover:text-slate-600"
        onClick={(e) => {
          e.stopPropagation();
          duplicateQuestion(questionIdx);
        }}
      />
      <TrashIcon
        className="h-4 cursor-pointer text-slate-500 hover:text-slate-600"
        onClick={(e) => {
          e.stopPropagation();
          deleteQuestion(questionIdx);
        }}
      />
    </div>
  );
}
