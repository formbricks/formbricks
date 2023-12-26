import {
  ChatBubbleBottomCenterTextIcon,
  ListBulletIcon,
  PresentationChartBarIcon,
  QueueListIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { CalendarDaysIcon, Phone } from "lucide-react";
import { RefObject, useEffect, useState } from "react";

import { checkForRecall } from "@formbricks/lib/utils/recall";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";

const questionIconMapping = {
  openText: ChatBubbleBottomCenterTextIcon,
  multipleChoiceSingle: QueueListIcon,
  multipleChoiceMulti: ListBulletIcon,
  rating: StarIcon,
  nps: PresentationChartBarIcon,
  date: CalendarDaysIcon,
  cal: Phone,
};

interface RecallQuestionSelectProps {
  localSurvey: TSurvey;
  question: TSurveyQuestion;
  addRecallQuestion: (question: TSurveyQuestion) => void;
  setShowQuestionSelect: (show: boolean) => void;
  showQuestionSelect: boolean;
  inputRef: RefObject<HTMLInputElement>;
  recallQuestions: TSurveyQuestion[];
}

export default function RecallQuestionSelect({
  localSurvey,
  question,
  addRecallQuestion,
  setShowQuestionSelect,
  showQuestionSelect,
  inputRef,
  recallQuestions,
}: RecallQuestionSelectProps) {
  const [focusedQuestionIdx, setFocusedQuestionIdx] = useState(0); // New state for managing focus
  const recallQuestionIds = recallQuestions.map((recallQuestion) => recallQuestion.id);
  const filteredRecallQuestions = localSurvey.questions.filter(
    (question) => !recallQuestionIds.includes(question.id)
  );
  const currentQuestionIdx = filteredRecallQuestions.findIndex(
    (recallQuestion) => recallQuestion.id === question.id
  );

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (showQuestionSelect) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setFocusedQuestionIdx((prevIdx) => (prevIdx + 1) % filteredRecallQuestions.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setFocusedQuestionIdx((prevIdx) =>
            prevIdx === 0 ? filteredRecallQuestions.length - 1 : prevIdx - 1
          );
        } else if (event.key === "Enter") {
          const selectedQuestion = filteredRecallQuestions[focusedQuestionIdx];

          addRecallQuestion(selectedQuestion);
          setShowQuestionSelect(false);
        }
      }
    };

    const inputElement = inputRef.current;
    inputElement?.addEventListener("keydown", handleKeyPress);

    return () => {
      inputElement?.removeEventListener("keydown", handleKeyPress);
    };
  }, [showQuestionSelect, localSurvey.questions, focusedQuestionIdx]);
  return (
    <div className="fixed z-30 mt-1 flex max-h-[50%] flex-col overflow-auto rounded-md border border-slate-300 bg-slate-50 p-3 text-xs">
      {currentQuestionIdx === 0 ? (
        <p className="font-medium text-slate-900">There is no information to recall yet 🤷</p>
      ) : (
        <p className="mb-2 font-medium">Recall Information from...</p>
      )}
      <div>
        {filteredRecallQuestions.map((q, idx) => {
          if (q.id === question.id) return;
          if (idx > currentQuestionIdx) return;
          if (recallQuestionIds.includes(q.id)) return;
          if (
            q.type === "fileUpload" ||
            q.type === "cta" ||
            q.type === "consent" ||
            q.type === "pictureSelection"
          )
            return;
          const isFocused = idx === focusedQuestionIdx;
          const IconComponent = questionIconMapping[q.type]; // Accessing the icon component
          return (
            <div
              key={idx}
              className={`flex cursor-pointer items-center rounded-md px-3 py-2 ${
                isFocused ? "bg-slate-200" : ""
              }`}
              onClick={() => {
                addRecallQuestion(q);
                setShowQuestionSelect(false);
              }}>
              <div>{IconComponent && <IconComponent className="mr-2 w-4" />}</div>
              <div>{checkForRecall(q.headline, localSurvey)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
