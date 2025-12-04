import { type JSX } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMatrixElement, TSurveyMatrixElementChoice } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledRowIndices } from "@/lib/utils";

interface MatrixElementProps {
  element: TSurveyMatrixElement;
  value: Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
}

export function MatrixElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
}: Readonly<MatrixElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);
  const rowShuffleIdx = useMemo(() => {
    if (element.shuffleOption !== "none") {
      return getShuffledRowIndices(element.rows.length, element.shuffleOption);
    }
    return element.rows.map((_, id) => id);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute when the shuffleOption changes
  }, [element.shuffleOption, element.rows.length]);

  const elementRows = useMemo(() => {
    if (!element.rows.length) {
      return [];
    }
    if (element.shuffleOption === "none") {
      return element.rows;
    }
    return rowShuffleIdx.map((shuffledIdx) => {
      return element.rows[shuffledIdx];
    });
  }, [element.shuffleOption, element.rows, rowShuffleIdx]);

  const handleSelect = useCallback(
    (column: string, row: string) => {
      let responseValue =
        Object.entries(value).length !== 0
          ? { ...value }
          : element.rows.reduce((obj: Record<string, string>, row: TSurveyMatrixElementChoice) => {
              obj[getLocalizedValue(row.label, languageCode)] = ""; // Initialize each row key with an empty string
              return obj;
            }, {});

      responseValue[row] = responseValue[row] === column ? "" : column;

      // Check if all values in responseValue are empty and if so, make it an empty object
      if (Object.values(responseValue).every((val) => val === "")) {
        responseValue = {};
      }

      onChange({ [element.id]: responseValue });
    },
    [value, element.rows, element.id, onChange, languageCode]
  );

  const handleSubmit = useCallback(
    (e: JSX.TargetedEvent<HTMLFormElement>) => {
      e.preventDefault();
      const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
      setTtc(updatedTtc);
    },
    [ttc, element.id, startTime, setTtc]
  );

  const columnsHeaders = useMemo(
    () =>
      element.columns.map((column, index) => (
        <th
          key={index}
          scope="col"
          className="fb-text-heading fb-max-w-40 fb-break-words fb-px-4 fb-py-2 fb-font-normal"
          dir="auto">
          {getLocalizedValue(column.label, languageCode)}
        </th>
      )),
    [element.columns, languageCode]
  );

  return (
    <form key={element.id} onSubmit={handleSubmit} className="fb-w-full">
      {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader subheader={getLocalizedValue(element.subheader, languageCode)} elementId={element.id} />
      <div className="fb-overflow-x-auto fb-py-4">
        <table className="fb-no-scrollbar fb-min-w-full fb-table-auto fb-border-collapse fb-text-sm">
          <thead>
            <tr>
              <th className="fb-px-4 fb-py-2" />
              {columnsHeaders}
            </tr>
          </thead>
          <tbody>
            {elementRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex.toString()}`} className={rowIndex % 2 === 0 ? "fb-bg-input-bg" : ""}>
                <th
                  scope="row"
                  className="fb-text-heading fb-rounded-l-custom fb-max-w-40 fb-break-words fb-pr-4 fb-pl-2 fb-py-2 fb-text-left fb-min-w-[20%] fb-font-semibold"
                  dir="auto">
                  {getLocalizedValue(row.label, languageCode)}
                </th>
                {element.columns.map((column, columnIndex) => (
                  <td
                    key={`column-${columnIndex.toString()}`}
                    tabIndex={0}
                    className={`fb-outline-brand fb-px-4 fb-py-2 fb-text-slate-800 ${columnIndex === element.columns.length - 1 ? "fb-rounded-r-custom" : ""}`}
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
                        required={element.required}
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
