import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useCallback, useMemo, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyQuestionChoice, TSurveyRankingQuestion } from "@formbricks/types/surveys/types";

interface RankingQuestionProps {
  question: TSurveyRankingQuestion;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: string;
}

export const RankingQuestion = ({
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
  autoFocusEnabled,
  currentQuestionId,
}: RankingQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const [sortedItems, setSortedItems] = useState<TSurveyQuestionChoice[]>(
    value
      .map((id) => question.choices.find((c) => c.id === id))
      .filter((item): item is TSurveyQuestionChoice => item !== undefined)
  );

  const [unsortedItems, setUnsortedItems] = useState<TSurveyQuestionChoice[]>(
    question.choices.filter((c) => !value.includes(c.id))
  );
  const [error, setError] = useState<string | null>(null);

  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const questionChoices = useMemo(
    () => question.choices.map((choice) => ({ id: choice.id, label: choice.label })),
    [question.choices]
  );

  const handleItemClick = useCallback(
    (item: TSurveyQuestionChoice) => {
      setSortedItems((prev) => {
        const isAlreadySorted = prev.some((sortedItem) => sortedItem.id === item.id);
        const newSortedItems = isAlreadySorted
          ? prev.filter((sortedItem) => sortedItem.id !== item.id)
          : [...prev, item];

        onChange({ [question.id]: newSortedItems.map((item) => item.id) });
        return newSortedItems;
      });

      setUnsortedItems((prev) => {
        const isAlreadySorted = sortedItems.some((sortedItem) => sortedItem.id === item.id);
        return isAlreadySorted ? [...prev, item] : prev.filter((unsortedItem) => unsortedItem.id !== item.id);
      });

      setError(null);
    },
    [onChange, question.id, sortedItems]
  );

  const handleMove = useCallback(
    (itemId: string, direction: "up" | "down") => {
      const index = sortedItems.findIndex((item) => item.id === itemId);
      if (index === -1) return;

      const newSortedItems = [...sortedItems];
      const [movedItem] = newSortedItems.splice(index, 1);
      const newIndex =
        direction === "up" ? Math.max(0, index - 1) : Math.min(newSortedItems.length, index + 1);

      newSortedItems.splice(newIndex, 0, movedItem);

      setSortedItems(newSortedItems);
      onChange({ [question.id]: newSortedItems.map((item) => item.id) });
      setError(null);
    },
    [sortedItems, onChange, question.id]
  );

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    const hasIncompleteRanking =
      (question.required && sortedItems.length !== questionChoices.length) ||
      (!question.required && sortedItems.length > 0 && sortedItems.length < questionChoices.length);

    if (hasIncompleteRanking) {
      setError("Please rank all items before submitting.");
      return;
    }

    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onSubmit(
      { [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)) },
      updatedTtcObj
    );
  };

  return (
    <form onSubmit={handleSubmit} className="fb-w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
          <div className="fb-mt-4">
            <fieldset>
              <legend className="fb-sr-only">Ranking Items</legend>
              <div className="fb-relative">
                {[...sortedItems, ...unsortedItems].map((item, idx) => {
                  if (!item) return;
                  const isSorted = sortedItems.includes(item);
                  const isFirst = isSorted && idx === 0;
                  const isLast = isSorted && idx === sortedItems.length - 1;

                  return (
                    <div
                      key={item.id}
                      tabIndex={idx + 1}
                      className={cn(
                        "fb-flex fb-h-12 fb-items-center fb-mb-2 fb-border fb-border-border fb-transition-all fb-text-heading focus-within:fb-border-brand hover:fb-bg-input-bg-selected focus:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-cursor-pointer focus:fb-outline-none fb-transform fb-duration-500 fb-ease-in-out",
                        isSorted ? "fb-bg-input-bg-selected" : "fb-bg-input-bg"
                      )}
                      autoFocus={idx === 0 && autoFocusEnabled}>
                      <div
                        className="fb-flex fb-gap-x-4 fb-px-4 fb-items-center fb-grow fb-h-full group"
                        onClick={() => handleItemClick(item)}>
                        <span
                          className={cn(
                            "fb-w-6 fb-grow-0 fb-h-6 fb-flex fb-items-center fb-justify-center fb-rounded-full fb-text-xs fb-font-semibold fb-border-brand fb-border",
                            isSorted
                              ? "fb-bg-brand fb-text-white fb-border"
                              : "fb-border-dashed group-hover:fb-bg-white fb-text-transparent group-hover:fb-text-heading"
                          )}>
                          {(idx + 1).toString()}
                        </span>
                        <div className="fb-grow fb-shrink fb-font-medium fb-text-sm">
                          {getLocalizedValue(item.label, languageCode)}
                        </div>
                      </div>
                      {isSorted && (
                        <div className="fb-flex fb-flex-col fb-h-full fb-grow-0 fb-border-l fb-border-border">
                          <button
                            type="button"
                            onClick={() => handleMove(item.id, "up")}
                            className={cn(
                              "fb-px-2 fb-flex fb-flex-1 fb-items-center fb-justify-center",
                              isFirst
                                ? "fb-opacity-30 fb-cursor-not-allowed"
                                : "hover:fb-bg-black/5 fb-rounded-tr-custom fb-transition-colors"
                            )}
                            disabled={isFirst}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-chevron-up">
                              <path d="m18 15-6-6-6 6" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(item.id, "down")}
                            className={cn(
                              "fb-px-2 fb-flex-1 fb-border-t fb-border-border fb-flex fb-items-center fb-justify-center",
                              isLast
                                ? "fb-opacity-30 fb-cursor-not-allowed"
                                : "hover:fb-bg-black/5 fb-rounded-br-custom fb-transition-colors"
                            )}
                            disabled={isLast}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-chevron-down">
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </div>
          {error && <div className="fb-text-red-500 fb-mt-2 fb-text-sm">{error}</div>}
        </div>
      </ScrollableContainer>

      <div className="fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            tabIndex={questionChoices.length + 3}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          tabIndex={questionChoices.length + 2}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
      </div>
    </form>
  );
};
