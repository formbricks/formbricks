import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useState } from "preact/hooks";

import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMatrixQuestion } from "@formbricks/types/surveys";

interface MatrixQuestionProps {
  question: TSurveyMatrixQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

const RowHeaders = ({ rows }: { rows: string[] }) => {
  return (
    <div className={` grid grid-rows-${rows.length + 1} gap-4 pb-6`}>
      <div>&nbsp;</div>
      {rows.map((row) => {
        return <div className="w-20 overflow-hidden text-ellipsis whitespace-nowrap">{row}</div>;
      })}
    </div>
  );
};

const MatrixColumns = ({ columns, rows }: { columns: string[]; rows: string[] }) => {
  return (
    <div className={` flex w-full space-x-2 overflow-auto pb-6`}>
      {columns.map((column) => {
        return (
          <div className={`grid grid-rows-${rows.length + 1} gap-4`}>
            <div className="w-20 overflow-hidden text-ellipsis whitespace-nowrap text-center">{column}</div>
            {rows.map((row) => {
              if (row.trim() === "" || column.trim() === "") return;
              return (
                <div className="text-center">
                  <input
                    type="radio"
                    id={column}
                    name={row}
                    value={column}
                    className=" h-4 w-4 cursor-pointer border border-black"></input>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default function MatrixQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  ttc,
  setTtc,
}: MatrixQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onSubmit({ [question.id]: value }, updatedttc);
        // }
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <div className="flex space-x-4">
          <RowHeaders rows={question.rows} />
          <MatrixColumns columns={question.columns} rows={question.rows} />
        </div>
      </div>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton buttonLabel={question.buttonLabel} isLastQuestion={isLastQuestion} onClick={() => {}} />
      </div>
    </form>
  );
}
