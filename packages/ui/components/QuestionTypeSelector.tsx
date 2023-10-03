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

export function QuestionTypeSelector({
  questionTypes,
  currentType,
  handleTypeChange,
}: QuestionTypeSelectorProps): JSX.Element {
  return (
    <div className="flex items-center rounded-md border p-2">
      {questionTypes.map((type, index) => (
        <div
          key={type.value}
          onClick={() => handleTypeChange(type.value)}
          className={`mr-2 cursor-pointer rounded-md ${
            (currentType === undefined && type.value === "text") || currentType === type.value
              ? "bg-slate-100"
              : "bg-white"
          }`}
          style={{ marginLeft: index !== 0 ? "8px" : "0" }}>
          {type.label}
        </div>
      ))}
    </div>
  );
}
