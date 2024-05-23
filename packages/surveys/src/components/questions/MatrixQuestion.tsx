import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { JSX } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TI18nString, TSurveyMatrixQuestion } from "@formbricks/types/surveys";

interface MatrixQuestionProps {
  question: TSurveyMatrixQuestion;
  value: Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentQuestionId: string;
}

export const MatrixQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
}: MatrixQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isSubmitButtonVisible = question.required ? Object.entries(value).length !== 0 : true;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const handleSelect = useCallback(
    (column: string, row: string) => {
      let responseValue =
        Object.entries(value).length !== 0
          ? { ...value }
          : question.rows.reduce((obj: Record<string, string>, key: TI18nString) => {
              obj[getLocalizedValue(key, languageCode)] = ""; // Initialize each row key with an empty string
              return obj;
            }, {});

      responseValue[row] = responseValue[row] === column ? "" : column;

      // Check if all values in responseValue are empty and if so, make it an empty object
      if (Object.values(responseValue).every((val) => val === "")) {
        responseValue = {};
      }

      onChange({ [question.id]: responseValue });
    },
    [value, question.rows, question.id, onChange, languageCode]
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
        <th key={index} className="text-heading max-w-40 break-words px-4 py-2 font-normal">
          {getLocalizedValue(column, languageCode)}
        </th>
      )),
    [question.columns, languageCode]
  );

  return (
    <form key={question.id} onSubmit={handleSubmit} className="w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={getLocalizedValue(question.subheader, languageCode)}
            questionId={question.id}
          />
          <div className="overflow-x-auto py-4">
            <table className="no-scrollbar min-w-full table-auto border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2"></th>
                  {columnsHeaders}
                </tr>
              </thead>
              <tbody>
                {question.rows.map((row, rowIndex) => (
                  // Table rows
                  <tr className={`${rowIndex % 2 === 0 ? "bg-input-bg" : ""}`}>
                    <td className="text-heading rounded-l-custom max-w-40 break-words px-4 py-2">
                      {getLocalizedValue(row, languageCode)}
                    </td>
                    {question.columns.map((column, columnIndex) => (
                      <td
                        key={columnIndex}
                        tabIndex={0}
                        className={`outline-brand px-4 py-2 text-gray-800 ${columnIndex === question.columns.length - 1 ? "rounded-r-custom" : ""}`}
                        onClick={() =>
                          handleSelect(
                            getLocalizedValue(column, languageCode),
                            getLocalizedValue(row, languageCode)
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === " ") {
                            e.preventDefault();
                            handleSelect(
                              getLocalizedValue(column, languageCode),
                              getLocalizedValue(row, languageCode)
                            );
                          }
                        }}>
                        <div className="flex items-center justify-center p-2">
                          {/* radio input  */}
                          <input
                            type="radio"
                            tabIndex={-1}
                            id={`${row}-${column}`}
                            name={getLocalizedValue(row, languageCode)}
                            value={getLocalizedValue(column, languageCode)}
                            checked={
                              typeof value === "object" && !Array.isArray(value)
                                ? value[getLocalizedValue(row, languageCode)] ===
                                  getLocalizedValue(column, languageCode)
                                : false
                            }
                            className="border-brand text-brand h-5 w-5 border focus:ring-0 focus:ring-offset-0"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ScrollableContainer>
      <div className="flex w-full justify-between px-6 py-4">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={handleBackButtonClick}
            tabIndex={0}
          />
        )}
        <div></div>
        {isSubmitButtonVisible && (
          <SubmitButton
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
            tabIndex={0}
          />
        )}
      </div>
    </form>
  );
};
