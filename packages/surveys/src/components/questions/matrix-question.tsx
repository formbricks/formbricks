import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledRowIndices } from "@/lib/utils";
import { type JSX } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
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
}: Readonly<MatrixQuestionProps>) {
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
    (e: JSX.TargetedEvent<HTMLFormElement>) => {
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
          className="fb-text-heading fb-max-w-40 fb-break-words fb-px-4 fb-py-2 fb-font-normal"
          dir="auto">
          {getLocalizedValue(column, languageCode)}
        </th>
      )),
    [question.columns, languageCode]
  );

  return (
    <ScrollableContainer>
      <form key={question.id} onSubmit={handleSubmit} className="fb-w-full">
        {isMediaAvailable ? <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} /> : null}
        <Headline
          headline={getLocalizedValue(question.headline, languageCode)}
          questionId={question.id}
          required={question.required}
        />
        <Subheader subheader={getLocalizedValue(question.subheader, languageCode)} questionId={question.id} />
        <div className="fb-overflow-x-auto fb-py-4">
          <table className="fb-no-scrollbar fb-min-w-full fb-table-auto fb-border-collapse fb-text-sm">
            <thead>
              <tr>
                <th className="fb-px-4 fb-py-2" />
                {columnsHeaders}
              </tr>
            </thead>
            <tbody>
              {questionRows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex.toString()}`} className={rowIndex % 2 === 0 ? "fb-bg-input-bg" : ""}>
                  <th
                    scope="row"
                    className="fb-text-heading fb-rounded-l-custom fb-max-w-40 fb-break-words fb-pr-4 fb-pl-2 fb-py-2 fb-text-left fb-min-w-[20%] fb-font-semibold"
                    dir="auto">
                    {getLocalizedValue(row, languageCode)}
                  </th>
                  {question.columns.map((column, columnIndex) => (
                    <td
                      key={`column-${columnIndex.toString()}`}
                      tabIndex={isCurrent ? 0 : -1}
                      className={`fb-outline-brand fb-px-4 fb-py-2 fb-text-slate-800 ${columnIndex === question.columns.length - 1 ? "fb-rounded-r-custom" : ""}`}
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
                      <div className="fb-flex fb-items-center fb-justify-center fb-p-2">
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
        <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-pt-4">
          <SubmitButton
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
            tabIndex={isCurrent ? 0 : -1}
          />
          {!isFirstQuestion && !isBackButtonHidden && (
            <BackButton
              backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
              onClick={handleBackButtonClick}
              tabIndex={isCurrent ? 0 : -1}
            />
          )}
        </div>
      </form>
    </ScrollableContainer>
  );
}
