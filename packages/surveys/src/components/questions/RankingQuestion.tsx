import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyRankingQuestion } from "@formbricks/types/surveys/types";

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
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const [sortedItems, setSortedItems] = useState<string[]>([]);
  const [unsortedItems, setUnsortedItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const questionChoices = useMemo(() => {
    return question.choices.filter((choice) => choice.id !== "other");
  }, [question.choices]);

  useEffect(() => {
    if (value.length > 0) {
      setSortedItems(value);
      setUnsortedItems(questionChoices.map((c) => c.id).filter((id) => !value.includes(id)));
    } else {
      setUnsortedItems(questionChoices.map((c) => c.id));
    }
  }, [value, questionChoices]);

  const handleItemClick = useCallback(
    (itemId: string) => {
      setSortedItems((prev) => {
        let newSorted;
        if (prev.length === 0) {
          // First click: just add the item to sortedItems
          newSorted = [itemId];
        } else if (prev.length === 1) {
          // Second click: sort both items
          newSorted = [prev[0], itemId];
        } else {
          // Subsequent clicks: add item to the end
          newSorted = [...prev, itemId];
        }
        setUnsortedItems((unsorted) => unsorted.filter((id) => id !== itemId));
        onChange({ [question.id]: newSorted });
        return newSorted;
      });
      setError(null);
    },
    [onChange, question.id]
  );

  const handleMove = useCallback(
    (itemId: string, direction: "up" | "down") => {
      setSortedItems((prev) => {
        const index = prev.indexOf(itemId);
        if (index === -1) return prev;
        const newIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(prev.length - 1, index + 1);
        const newSortedItems = [...prev];
        newSortedItems.splice(index, 1);
        newSortedItems.splice(newIndex, 0, itemId);
        onChange({ [question.id]: newSortedItems });
        return newSortedItems;
      });
      setError(null);
    },
    [onChange, question.id]
  );

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    console.log(sortedItems);
    if (question.required && sortedItems.length !== questionChoices.length) {
      setError("Please rank all items before submitting.");
      return;
    }
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onSubmit({ [question.id]: sortedItems }, updatedTtcObj);
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
            {[...sortedItems, ...unsortedItems].map((itemId, idx) => {
              const choice = questionChoices.find((c) => c.id === itemId);
              if (!choice) return null;
              const isSorted = sortedItems.includes(itemId);
              return (
                <div
                  autoFocus={idx === 0 && autoFocusEnabled}
                  key={choice.id}
                  tabIndex={idx + 1}
                  onClick={() => !isSorted && handleItemClick(itemId)}
                  className={cn(
                    "fb-flex fb-items-center fb-mb-2 fb-p-4 fb-rounded-custom fb-border fb-transition-all",
                    isSorted ? "fb-border-brand fb-bg-input-bg-selected" : "fb-border-border fb-bg-input-bg"
                  )}>
                  <span className="fb-mr-4 fb-w-6 fb-h-6 fb-flex fb-items-center fb-justify-center fb-border fb-border-dashed fb-rounded-full">
                    {isSorted && sortedItems.indexOf(itemId) + 1}
                  </span>
                  <div className={cn("fb-flex-grow", !isSorted ? "fb-cursor-pointer" : "")}>
                    {getLocalizedValue(choice.label, languageCode)}
                  </div>
                  {isSorted && (
                    <div className="fb-ml-2 fb-flex fb-flex-col">
                      <button
                        type="button"
                        onClick={() => handleMove(itemId, "up")}
                        className="fb-p-1 fb-text-sm fb-bg-gray-100 fb-rounded-t"
                        disabled={sortedItems.indexOf(itemId) === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(itemId, "down")}
                        className="fb-p-1 fb-text-sm fb-bg-gray-100 fb-rounded-b"
                        disabled={sortedItems.indexOf(itemId) === sortedItems.length - 1}>
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {error && <div className="fb-text-red-500 fb-mt-2">{error}</div>}
        </div>
      </ScrollableContainer>

      <div className="fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={questionChoices.length + 3}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
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
