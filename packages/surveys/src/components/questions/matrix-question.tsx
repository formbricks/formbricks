import { type JSX } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMatrixElement, TSurveyMatrixElementChoice } from "@formbricks/types/surveys/elements";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledRowIndices } from "@/lib/utils";

interface MatrixQuestionProps {
  question: TSurveyMatrixElement;
  value: Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentQuestionId: string;
}

export function MatrixQuestion({
  question,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
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
          : question.rows.reduce((obj: Record<string, string>, row: TSurveyMatrixElementChoice) => {
              obj[getLocalizedValue(row.label, languageCode)] = ""; // Initialize each row key with an empty string
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
    },
    [ttc, question.id, startTime, setTtc]
  );

  const columnsHeaders = useMemo(
    () =>
      question.columns.map((column, index) => (
        <th
          key={index}
          scope="col"
          className="fb-text-heading fb-max-w-40 fb-break-words fb-px-4 fb-py-2 fb-font-normal"
          dir="auto">
          {getLocalizedValue(column.label, languageCode)}
        </th>
      )),
    [question.columns, languageCode]
  );

  return (
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
                  {getLocalizedValue(row.label, languageCode)}
                </th>
                {question.columns.map((column, columnIndex) => (
                  <td
                    key={`column-${columnIndex.toString()}`}
                    tabIndex={isCurrent ? 0 : -1}
                    className={`fb-outline-brand fb-px-4 fb-py-2 fb-text-slate-800 ${columnIndex === question.columns.length - 1 ? "fb-rounded-r-custom" : ""}`}
                    onClick={() => {
                      handleSelect(
                        getLocalizedValue(column.label, languageCode),
                        getLocalizedValue(row.label, languageCode)
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " ") {
                        e.preventDefault();
                        handleSelect(
                          getLocalizedValue(column.label, languageCode),
                          getLocalizedValue(row.label, languageCode)
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
                        name={getLocalizedValue(row.label, languageCode)}
                        value={getLocalizedValue(column.label, languageCode)}
                        checked={
                          typeof value === "object" && !Array.isArray(value)
                            ? value[getLocalizedValue(row.label, languageCode)] ===
                              getLocalizedValue(column.label, languageCode)
                            : false
                        }
                        aria-label={`${getLocalizedValue(row.label, languageCode)} – ${getLocalizedValue(
                          column.label,
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
    </form>
  );
}
