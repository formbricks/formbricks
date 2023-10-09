import {
  ChatBubbleBottomCenterTextIcon,
  EnvelopeIcon,
  HashtagIcon,
  LinkIcon,
  PhoneIcon,
} from "@heroicons/react/24/solid";
import React from "react";

interface QuestionType {
  value: string;
  label: string;
}

interface QuestionTypeSelectorProps {
  questionTypes: QuestionType[];
  currentType: string | undefined;
  handleTypeChange: (value: string) => void;
}

const typeIcons: { [key: string]: React.ReactNode } = {
  text: <ChatBubbleBottomCenterTextIcon />,
  email: <EnvelopeIcon />,
  url: <LinkIcon />,
  number: <HashtagIcon />,
  phone: <PhoneIcon />,
};

export function QuestionTypeSelector({
  questionTypes,
  currentType,
  handleTypeChange,
}: QuestionTypeSelectorProps): JSX.Element {
  return (
    <div className="flex w-full items-center justify-between rounded-md border p-1">
      {questionTypes.map((type) => (
        <div
          key={type.value}
          onClick={() => handleTypeChange(type.value)}
          className={`flex-grow cursor-pointer rounded-md bg-${
            (currentType === undefined && type.value === "text") || currentType === type.value
              ? "slate-100"
              : "white"
          } p-2 text-center`}>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-sm text-slate-900">{type.label}</span>
            <div className="h-4 w-4 text-slate-600 hover:text-slate-800">{typeIcons[type.value]}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
