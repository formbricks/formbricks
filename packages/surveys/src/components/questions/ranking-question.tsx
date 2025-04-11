import { useAutoAnimate } from "@formkit/auto-animate/react";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type {
  TSurveyQuestionChoice,
  TSurveyQuestionId,
  TSurveyRankingQuestion,
} from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { cn, getShuffledChoicesIds } from "../../lib/utils";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

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
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function RankingQuestion({
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
  isBackButtonHidden,
}: RankingQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = question.id === currentQuestionId;
  const shuffledChoicesIds = useMemo(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    }
    return question.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.shuffleOption, question.choices.length]);

  const [parent] = useAutoAnimate();

  const [error, setError] = useState<string | null>(null);
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const [localValue, setLocalValue] = useState<string[]>(value ?? []);

  const sortedItems = useMemo(() => {
    return localValue
      .map((id) => question.choices.find((c) => c.id === id))
      .filter((item): item is TSurveyQuestionChoice => item !== undefined);
  }, [localValue, question.choices]);

  const unsortedItems = useMemo(() => {
    if (question.shuffleOption === "all" && sortedItems.length === 0) {
      return shuffledChoicesIds.map((id) => question.choices.find((c) => c.id === id));
    }
    return question.choices.filter((c) => !localValue.includes(c.id));
  }, [question.choices, question.shuffleOption, localValue, sortedItems, shuffledChoicesIds]);

  const handleItemClick = useCallback(
    (item: TSurveyQuestionChoice) => {
      const isAlreadySorted = localValue.includes(item.id);
      const newLocalValue = isAlreadySorted
        ? localValue.filter((id) => id !== item.id)
        : [...localValue, item.id];

      setLocalValue(newLocalValue);

      setError(null);
    },
    [localValue]
  );

  const handleMove = useCallback(
    (itemId: string, direction: "up" | "down") => {
      const index = localValue.findIndex((id) => id === itemId);
      if (index === -1) return;

      const newLocalValue = [...localValue];
      const [movedItem] = newLocalValue.splice(index, 1);
      const newIndex =
        direction === "up" ? Math.max(0, index - 1) : Math.min(newLocalValue.length, index + 1);
      newLocalValue.splice(newIndex, 0, movedItem);
      setLocalValue(newLocalValue);

      setError(null);
    },
    [localValue]
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const hasIncompleteRanking =
      (question.required && sortedItems.length !== question.choices.length) ||
      (!question.required && sortedItems.length > 0 && sortedItems.length < question.choices.length);

    if (hasIncompleteRanking) {
      setError("Please rank all items before submitting.");
      return;
    }

    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onChange({
      [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)),
    });
    onSubmit(
      { [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)) },
      updatedTtcObj
    );
  };

  const handleBack = () => {
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onChange({
      [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)),
    });
    onBack();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
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
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
          <div className="mt-4">
            <fieldset>
              <legend className="sr-only">Ranking Items</legend>
              <div className="relative" ref={parent}>
                {[...sortedItems, ...unsortedItems].map((item, idx) => {
                  if (!item) return null;
                  const isSorted = sortedItems.includes(item);
                  const isFirst = isSorted && idx === 0;
                  const isLast = isSorted && idx === sortedItems.length - 1;

                  return (
                    <div
                      key={item.id}
                      tabIndex={isCurrent ? 0 : -1}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          handleItemClick(item);
                        }
                      }}
                      className={cn(
                        "border-border text-heading focus-within:border-brand hover:bg-input-bg-selected focus:bg-input-bg-selected rounded-custom relative mb-2 flex h-12 transform cursor-pointer items-center border transition-all duration-500 ease-in-out focus:outline-none",
                        isSorted ? "bg-input-bg-selected" : "bg-input-bg"
                      )}
                      autoFocus={idx === 0 && autoFocusEnabled}>
                      <div
                        className="group flex h-full grow items-center gap-x-4 px-4"
                        onClick={() => {
                          handleItemClick(item);
                        }}>
                        <span
                          className={cn(
                            "border-brand flex h-6 w-6 grow-0 items-center justify-center rounded-full border text-xs font-semibold",
                            isSorted
                              ? "bg-brand border text-white"
                              : "group-hover:text-heading border-dashed text-transparent group-hover:bg-white"
                          )}>
                          {(idx + 1).toString()}
                        </span>
                        <div className="shrink grow text-sm font-medium">
                          {getLocalizedValue(item.label, languageCode)}
                        </div>
                      </div>
                      {isSorted ? (
                        <div className="border-border flex h-full grow-0 flex-col border-l">
                          <button
                            tabIndex={-1}
                            type="button"
                            onClick={() => {
                              handleMove(item.id, "up");
                            }}
                            className={cn(
                              "flex flex-1 items-center justify-center px-2",
                              isFirst
                                ? "cursor-not-allowed opacity-30"
                                : "rounded-tr-custom transition-colors hover:bg-black/5"
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
                            tabIndex={-1}
                            type="button"
                            onClick={() => {
                              handleMove(item.id, "down");
                            }}
                            className={cn(
                              "border-border flex flex-1 items-center justify-center border-t px-2",
                              isLast
                                ? "cursor-not-allowed opacity-30"
                                : "rounded-br-custom transition-colors hover:bg-black/5"
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
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </div>
          {error ? <div className="mt-2 text-sm text-red-500">{error}</div> : null}
        </div>
      </ScrollableContainer>

      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            tabIndex={isCurrent ? 0 : -1}
            onClick={handleBack}
          />
        )}
      </div>
    </form>
  );
}
