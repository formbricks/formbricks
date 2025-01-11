import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledRowIndices } from "@/lib/utils";
import { JSX } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TI18nString, TSurveyMatrixQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";

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
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const isCurrent = question.id === currentQuestionId;
  const rowShuffleIdx = useMemo(() => {
    if (question.shuffleOption) {
      return getShuffledRowIndices(question.rows.length, question.shuffleOption);
    } else {
      return question.rows.map((_, id) => id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.shuffleOption, question.rows.length]);

  const questionRows = useMemo(() => {
    if (!question.rows) {
      return [];
    }
    if (question.shuffleOption === "none" || question.shuffleOption === undefined) {
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
        <th
          key={index}
          className="fb-text-heading fb-max-w-40 fb-break-words fb-px-4 fb-py-2 fb-font-normal"
          dir="auto">
          {getLocalizedValue(column, languageCode)}
        </th>
      )),
    [question.columns, languageCode]
  );

  return (
    <form key={question.id} onSubmit={handleSubmit} className="fb-w-full">
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
          <div className="fb-overflow-x-auto fb-py-4">
            <table className="fb-no-scrollbar fb-min-w-full fb-table-auto fb-border-collapse fb-text-sm">
              <thead>
                <tr>
                  <th className="fb-px-4 fb-py-2"></th>
                  {columnsHeaders}
                </tr>
              </thead>
              <tbody>
                {questionRows.map((row, rowIndex) => (
                  // Table rows
                  <tr className={`${rowIndex % 2 === 0 ? "bg-input-bg" : ""}`}>
                    <td
                      className="fb-text-heading fb-rounded-l-custom fb-max-w-40 fb-break-words fb-pr-4 fb-pl-2 fb-py-2"
                      dir="auto">
                      {getLocalizedValue(row, languageCode)}
                    </td>
                    {question.columns.map((column, columnIndex) => (
                      <td
                        key={columnIndex}
                        tabIndex={isCurrent ? 0 : -1}
                        className={`fb-outline-brand fb-px-4 fb-py-2 fb-text-slate-800 ${columnIndex === question.columns.length - 1 ? "fb-rounded-r-custom" : ""}`}
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
                        }}
                        dir="auto">
                        <div className="fb-flex fb-items-center fb-justify-center fb-p-2">
                          {/* radio input  */}
                          <input
                            dir="auto"
                            type="radio"
                            tabIndex={-1}
                            required={question.required}
                            id={`${row}-${column}`}
                            name={getLocalizedValue(row, languageCode)}
                            value={getLocalizedValue(column, languageCode)}
                            checked={
                              typeof value === "object" && !Array.isArray(value)
                                ? value[getLocalizedValue(row, languageCode)] ===
                                  getLocalizedValue(column, languageCode)
                                : false
                            }
                            className="fb-border-brand fb-text-brand fb-h-5 fb-w-5 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
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
      <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-px-6 fb-py-4">
        <SubmitButton
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
          tabIndex={isCurrent ? 0 : -1}
        />
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={handleBackButtonClick}
            tabIndex={isCurrent ? 0 : -1}
          />
        )}
      </div>
    </form>
  );
};
