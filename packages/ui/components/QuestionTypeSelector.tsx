import React from "react";
import {
  PhoneIcon,
  LinkIcon,
  EnvelopeIcon,
  ChatBubbleBottomCenterTextIcon,
  HashtagIcon,
} from "@heroicons/react/24/solid";

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
    <div className="flex w-full items-center justify-between rounded-md border p-2">
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
            <span>{type.label}</span>
            <div className="h-4 w-4">{typeIcons[type.value]}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
