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

  const [sortedItems, setSortedItems] = useState<Array<{ id: string; label: string }>>([]);
  const [unsortedItems, setUnsortedItems] = useState<Array<{ id: string; label: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const questionChoices = useMemo(() => {
    return question.choices.filter((choice) => choice.id !== "other");
  }, [question.choices]);

  useEffect(() => {
    if (value.length > 0) {
      setSortedItems(
        value.map((id) => {
          const choice = questionChoices.find((c) => c.id === id);
          return { id, label: getLocalizedValue(choice?.label, languageCode) };
        })
      );
      setUnsortedItems(
        questionChoices
          .filter((c) => !value.includes(c.id))
          .map((c) => ({ id: c.id, label: getLocalizedValue(c.label, languageCode) }))
      );
    } else {
      setUnsortedItems(
        questionChoices.map((c) => ({
          id: c.id,
          label: getLocalizedValue(c.label, languageCode),
        }))
      );
    }
  }, [value, questionChoices, languageCode]);

  const handleItemClick = useCallback(
    (item: { id: string; label: string }) => {
      setSortedItems((prev) => {
        let newSorted;
        if (prev.length === 0) {
          newSorted = [item];
        } else if (prev.length === 1) {
          newSorted = [prev[0], item];
        } else {
          newSorted = [...prev, item];
        }
        setUnsortedItems((unsorted) => unsorted.filter((i) => i.id !== item.id));
        onChange({ [question.id]: newSorted.map((i) => i.id) });
        return newSorted;
      });
      setError(null);
    },
    [onChange, question.id]
  );
  const handleMove = useCallback(
    (itemId: string, direction: "up" | "down") => {
      setSortedItems((prev) => {
        const index = prev.findIndex((item) => item.id === itemId);
        if (index === -1) return prev;
        const newIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(prev.length - 1, index + 1);
        const newSortedItems = [...prev];
        const [movedItem] = newSortedItems.splice(index, 1);
        newSortedItems.splice(newIndex, 0, movedItem);
        onChange({ [question.id]: newSortedItems.map((item) => item.id) });
        return newSortedItems;
      });
      setError(null);
    },
    [onChange, question.id]
  );
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (question.required && sortedItems.length !== questionChoices.length) {
      setError("Please rank all items before submitting.");
      return;
    }
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onSubmit({ [question.id]: sortedItems.map((item) => item.label) }, updatedTtcObj);
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
            {[...sortedItems, ...unsortedItems].map((item, idx) => {
              const isSorted = sortedItems.includes(item);
              return (
                <div
                  autoFocus={idx === 0 && autoFocusEnabled}
                  key={item.id}
                  tabIndex={idx + 1}
                  onClick={() => !isSorted && handleItemClick(item)}
                  className={cn(
                    "fb-flex fb-items-center fb-mb-2 fb-px-4 fb-py-2 fb-rounded-lg fb-border fb-transition-all",
                    isSorted ? "fb-border-brand fb-bg-white" : "fb-border-gray-300 fb-bg-white"
                  )}>
                  <span className="fb-mr-4 fb-w-4 fb-h-4 fb-flex fb-items-center fb-justify-center fb-border fb-border-dashed fb-rounded-full">
                    {isSorted && sortedItems.findIndex((i) => i.id === item.id) + 1}
                  </span>
                  <div className={cn("fb-flex-grow fb-text-gray-700", !isSorted ? "fb-cursor-pointer" : "")}>
                    {item.label}
                  </div>
                  <div className="fb-ml-auto fb-flex fb-flex-col fb-border-l fb-border-gray-300">
                    <button
                      type="button"
                      onClick={() => handleMove(item.id, "up")}
                      className="fb-p-1 fb-text-sm fb-bg-gray-100 fb-rounded-none fb-border-b fb-border-gray-300"
                      disabled={sortedItems.findIndex((i) => i.id === item.id) === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(item.id, "down")}
                      className="fb-p-1 fb-text-sm fb-bg-gray-100 fb-rounded-none"
                      disabled={sortedItems.findIndex((i) => i.id === item.id) === sortedItems.length - 1}>
                      ↓
                    </button>
                  </div>
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
