import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { JSX } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";

import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMatrixQuestion } from "@formbricks/types/surveys";

interface MatrixQuestionProps {
  question: TSurveyMatrixQuestion;
  value: Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}
interface MatrixQuestionRowProps {
  row: string;
  rowIndex: number;
  columns: string[];
  value: Record<string, string>;
  handleOnChange: (column: string, row: string) => void;
}

const MatrixQuestionRow = ({ row, rowIndex, columns, value, handleOnChange }: MatrixQuestionRowProps) => {
  return (
    <tr className={`${rowIndex % 2 === 0 ? "bg-gray-100" : ""}`}>
      <td className="max-w-40 break-words px-4 py-2">{row}</td>
      {columns.map((column, columnIndex) => (
        <td key={columnIndex} className="px-4 py-2 text-gray-800">
          <div className="flex items-center justify-center p-2">
            <input
              type="radio"
              id={`${row}-${column}`}
              name={row}
              value={column}
              required={true} // Adjust based on your requirements
              checked={typeof value === "object" && !Array.isArray(value) ? value[row] === column : false}
              className="h-4 w-4 cursor-pointer border border-black"
              onChange={() => handleOnChange(column, row)}
            />
          </div>
        </td>
      ))}
    </tr>
  );
};

export const MatrixQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  ttc,
  setTtc,
}: MatrixQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const handleOnChange = useCallback(
    (column: string, row: string) => {
      const responseValue = value
        ? { ...value }
        : // mapping each row in `question.rows` to an empty string.
          question.rows.reduce((obj: Record<string, string>, key: string) => {
            obj[key] = ""; // Initialize each row key with an empty string
            return obj;
          }, {});

      responseValue[row] = column;
      onChange({ [question.id]: responseValue });
    },
    [value, question.rows, question.id, onChange]
  );

  const handleSubmit = useCallback(
    (e: JSX.TargetedEvent<HTMLFormElement, Event>) => {
      e.preventDefault();
      const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
      setTtc(updatedTtc);
      onSubmit({ [question.id]: value }, updatedTtc);
    },
    [ttc, question.id, startTime, value, onSubmit, setTtc]
  );

  const handleBackButtonClick = useCallback(() => {
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    onBack();
  }, [ttc, question.id, startTime, onBack, setTtc]);

  const columnsHeaders = useMemo(
    () =>
      question.columns.map((column, index) => (
        <th key={index} className="max-w-40 break-words px-4 py-2 text-gray-800">
          {column}
        </th>
      )),
    [question.columns]
  );

  return (
    <form key={question.id} onSubmit={handleSubmit} className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4 max-h-[33vh] overflow-auto">
        <table className="min-w-full table-auto border-collapse border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-gray-800"></th>
              {columnsHeaders}
            </tr>
          </thead>
          <tbody>
            {question.rows.map((row, rowIndex) => (
              <MatrixQuestionRow
                key={rowIndex}
                row={row}
                rowIndex={rowIndex}
                columns={question.columns}
                value={value}
                handleOnChange={handleOnChange}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton backButtonLabel={question.backButtonLabel} onClick={handleBackButtonClick} />
        )}
        <div></div>
        <SubmitButton buttonLabel={question.buttonLabel} isLastQuestion={isLastQuestion} onClick={() => {}} />
      </div>
    </form>
  );
};
