import {
  ArrowUpTrayIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckIcon,
  CursorArrowRippleIcon,
  ListBulletIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  QueueListIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import React from "react";
import { useEffect, useState } from "react";

import { checkForRecall } from "@formbricks/lib/utils/recall";

const questionIconMapping = {
  openText: ChatBubbleBottomCenterTextIcon,
  multipleChoiceSingle: QueueListIcon,
  multipleChoiceMulti: ListBulletIcon,
  pictureSelection: PhotoIcon,
  rating: StarIcon,
  nps: PresentationChartBarIcon,
  cta: CursorArrowRippleIcon,
  consent: CheckIcon,
  fileUpload: ArrowUpTrayIcon,
};

export default function RecallQuestionSelect({
  currentQuestionIdx,
  localSurvey,
  question,
  addRecallQuestion,
  setShowQuestionSelect,
  showQuestionSelect,
  inputRef,
}) {
  const [focusedQuestionIdx, setFocusedQuestionIdx] = useState(0); // New state for managing focus

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (showQuestionSelect) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setFocusedQuestionIdx((prevIdx) => (prevIdx + 1) % localSurvey.questions.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setFocusedQuestionIdx((prevIdx) =>
            prevIdx === 0 ? localSurvey.questions.length - 1 : prevIdx - 1
          );
        } else if (event.key === "Enter") {
          const selectedQuestion = localSurvey.questions[focusedQuestionIdx];

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
    <div className="fixed z-30 flex flex-col border bg-white p-1 text-xs">
      {currentQuestionIdx === 0 ? (
        <p className="p-2 font-medium">There is no information to recall yet</p>
      ) : (
        <p className="p-2 font-medium">Recall Information from...</p>
      )}
      <div>
        {localSurvey.questions.map((q, idx) => {
          if (q.id === question.id) return;
          if (idx > currentQuestionIdx) return;
          const isFocused = idx === focusedQuestionIdx;
          const IconComponent = questionIconMapping[q.type]; // Accessing the icon component
          return (
            <div
              key={idx}
              className={`flex cursor-pointer items-center p-2 ${isFocused ? "bg-slate-100" : ""}`}
              onClick={() => {
                addRecallQuestion(q);
                setShowQuestionSelect(false);
              }}>
              {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
              {checkForRecall(q.headline, localSurvey)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
