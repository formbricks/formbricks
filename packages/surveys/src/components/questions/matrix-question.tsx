import { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TI18nString, TSurveyMatrixQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { getShuffledRowIndices } from "../../lib/utils";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

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
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function MatrixQuestion({
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
  isBackButtonHidden,
}: MatrixQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const isCurrent = question.id === currentQuestionId;
  const rowShuffleIdx = useMemo(() => {
    if (question.shuffleOption !== "none") {
      return getShuffledRowIndices(question.rows.length, question.shuffleOption);
    }
    return question.rows.map((_, id) => id);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute when the shuffleOption changes
  }, [question.shuffleOption, question.rows.length]);

  const questionRows = useMemo(() => {
    if (!question.rows.length) {
      return [];
    }
    if (question.shuffleOption === "none") {
      return question.rows;
    }
    return rowShuffleIdx.map((shuffledIdx) => {
      return question.rows[shuffledIdx];
    });
  }, [question.shuffleOption, question.rows, rowShuffleIdx]);

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
    (e: FormEvent<HTMLFormElement>) => {
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
        <th
          key={index}
          scope="col"
          className="text-heading max-w-40 break-words px-4 py-2 font-normal"
          dir="auto">
          {getLocalizedValue(column, languageCode)}
        </th>
      )),
    [question.columns, languageCode]
  );

  return (
    <form key={question.id} onSubmit={handleSubmit} className="w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
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
                  <th className="px-4 py-2" />
                  {columnsHeaders}
                </tr>
              </thead>
              <tbody>
                {questionRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex.toString()}`} className={rowIndex % 2 === 0 ? "bg-input-bg" : ""}>
                    <th
                      scope="row"
                      className="text-heading rounded-l-custom min-w-[20%] max-w-40 break-words py-2 pl-2 pr-4 text-left font-semibold"
                      dir="auto">
                      {getLocalizedValue(row, languageCode)}
                    </th>
                    {question.columns.map((column, columnIndex) => (
                      <td
                        key={`column-${columnIndex.toString()}`}
                        tabIndex={isCurrent ? 0 : -1}
                        className={`outline-brand px-4 py-2 text-slate-800 ${columnIndex === question.columns.length - 1 ? "rounded-r-custom" : ""}`}
                        onClick={() => {
                          handleSelect(
                            getLocalizedValue(column, languageCode),
                            getLocalizedValue(row, languageCode)
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " ") {
                            e.preventDefault();
                            handleSelect(
                              getLocalizedValue(column, languageCode),
                              getLocalizedValue(row, languageCode)
                            );
                          }
                        }}
                        dir="auto">
                        <div className="flex items-center justify-center p-2">
                          <input
                            dir="auto"
                            type="radio"
                            tabIndex={-1}
                            required={question.required}
                            id={`row${rowIndex.toString()}-column${columnIndex.toString()}`}
                            name={getLocalizedValue(row, languageCode)}
                            value={getLocalizedValue(column, languageCode)}
                            checked={
                              typeof value === "object" && !Array.isArray(value)
                                ? value[getLocalizedValue(row, languageCode)] ===
                                  getLocalizedValue(column, languageCode)
                                : false
                            }
                            aria-label={`${getLocalizedValue(
                              question.headline,
                              languageCode
                            )}: ${getLocalizedValue(row, languageCode)} – ${getLocalizedValue(
                              column,
                              languageCode
                            )}`}
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
      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        {!isFirstQuestion && !isBackButtonHidden ? (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={handleBackButtonClick}
            tabIndex={isCurrent ? 0 : -1}
          />
        ) : (
          <div />
        )}
        <div />
        <SubmitButton
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          tabIndex={isCurrent ? 0 : -1}
        />
      </div>
    </form>
  );
}
