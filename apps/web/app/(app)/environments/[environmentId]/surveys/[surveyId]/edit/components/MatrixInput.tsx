import { TrashIcon } from "lucide-react";

import { TSurveyMatrixQuestion } from "@formbricks/types/surveys";
import { Input } from "@formbricks/ui/Input";

interface MatrixLabelInputProps {
  question: TSurveyMatrixQuestion;
  index: number;
  type: "row" | "column";
  onDelete: () => void;
  handleOnChange: (index: number, type: "row" | "column", e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
}

export const MatrixLabelInput = ({
  question,
  index,
  type,
  onDelete,
  handleOnChange,
  value,
}: MatrixLabelInputProps) => {
  return (
    <div className="flex items-center">
      <Input onChange={(e) => handleOnChange(index, type, e)} value={value} />
      {(type === "row" ? question.rows.length > 2 : question.columns.length > 2) && (
        <TrashIcon
          className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
          onClick={onDelete}
        />
      )}
    </div>
  );
};
