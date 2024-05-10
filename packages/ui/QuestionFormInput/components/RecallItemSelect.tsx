import {
  CalendarDaysIcon,
  EyeOffIcon,
  HomeIcon,
  ListIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  StarIcon,
  TagIcon,
} from "lucide-react";
import { RefObject, useEffect, useMemo, useState } from "react";

import { replaceRecallInfoWithUnderline } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSurvey, TSurveyHiddenFields, TSurveyQuestion, TSurveyRecallItem } from "@formbricks/types/surveys";

const questionIconMapping = {
  openText: MessageSquareTextIcon,
  multipleChoiceSingle: Rows3Icon,
  multipleChoiceMulti: ListIcon,
  rating: StarIcon,
  nps: PresentationIcon,
  date: CalendarDaysIcon,
  cal: PhoneIcon,
  address: HomeIcon,
};

interface RecallItemSelectProps {
  localSurvey: TSurvey;
  questionId: string;
  addRecallItem: (question: TSurveyRecallItem) => void;
  setShowRecallItemSelect: (show: boolean) => void;
  showRecallItemSelect: boolean;
  inputRef: RefObject<HTMLInputElement>;
  recallItems: TSurveyRecallItem[];
  selectedLanguageCode: string;
  hiddenFields: TSurveyHiddenFields;
  attributeClasses: TAttributeClass[];
}

export const RecallItemSelect = ({
  localSurvey,
  questionId,
  addRecallItem,
  setShowRecallItemSelect,
  showRecallItemSelect,
  inputRef,
  recallItems,
  selectedLanguageCode,
  attributeClasses,
}: RecallItemSelectProps) => {
  const [focusedQuestionIdx, setFocusedQuestionIdx] = useState(0); // state for managing focus
  const isNotAllowedQuestionType = (question: TSurveyQuestion): boolean => {
    return (
      question.type === "fileUpload" ||
      question.type === "cta" ||
      question.type === "consent" ||
      question.type === "pictureSelection" ||
      question.type === "cal" ||
      question.type === "matrix"
    );
  };

  const recallItemIds = useMemo(() => {
    return recallItems.map((recallItem) => recallItem.id);
  }, [recallItems]);

  const hiddenFieldRecallItems = useMemo(() => {
    if (localSurvey.type !== "link") return [];
    if (localSurvey.hiddenFields.fieldIds) {
      return localSurvey.hiddenFields.fieldIds
        .filter((hiddenFieldId) => {
          return !recallItemIds.includes(hiddenFieldId);
        })
        .map((hiddenFieldId) => ({
          id: hiddenFieldId,
          label: hiddenFieldId,
          type: "hiddenField" as const,
        }));
    }
    return [];
  }, [localSurvey.hiddenFields]);

  const attributeClassRecallItems = useMemo(() => {
    if (localSurvey.type === "link") return [];
    return attributeClasses
      .filter((attributeClass) => !recallItemIds.includes(attributeClass.name.replaceAll(" ", "nbsp")))
      .map((attributeClass) => {
        return {
          id: attributeClass.name.replaceAll(" ", "nbsp"),
          label: attributeClass.name,
          type: "attributeClass" as const,
        };
      });
  }, [attributeClasses]);

  const surveyQuestionRecallItems = useMemo(() => {
    const idx =
      questionId === "end"
        ? localSurvey.questions.length
        : localSurvey.questions.findIndex((recallQuestion) => recallQuestion.id === questionId);
    const filteredQuestions = localSurvey.questions
      .filter((question, index) => {
        const notAllowed = isNotAllowedQuestionType(question);
        return (
          !recallItemIds.includes(question.id) && !notAllowed && question.id !== questionId && idx > index
        );
      })
      .map((question) => {
        return { id: question.id, label: question.headline[selectedLanguageCode], type: "question" as const };
      });

    return filteredQuestions;
  }, [localSurvey.questions, questionId, recallItemIds]);

  const filteredRecallItems: TSurveyRecallItem[] = useMemo(() => {
    return [...surveyQuestionRecallItems, ...hiddenFieldRecallItems, ...attributeClassRecallItems];
  }, [surveyQuestionRecallItems, hiddenFieldRecallItems, attributeClassRecallItems]);

  // function to modify headline (recallInfo to corresponding headline)
  const getRecallLabel = (label: string): string => {
    return replaceRecallInfoWithUnderline(label);
  };

  // function to handle key press
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (showRecallItemSelect) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setFocusedQuestionIdx((prevIdx) => (prevIdx + 1) % filteredRecallItems.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setFocusedQuestionIdx((prevIdx) => (prevIdx === 0 ? filteredRecallItems.length - 1 : prevIdx - 1));
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          const selectedQuestion = filteredRecallItems[focusedQuestionIdx];
          setShowRecallItemSelect(false);
          if (!selectedQuestion) return;
          addRecallItem(selectedQuestion);
        }
      }
    };

    const inputElement = inputRef.current;
    inputElement?.addEventListener("keydown", handleKeyPress);

    return () => {
      inputElement?.removeEventListener("keydown", handleKeyPress);
    };
  }, [showRecallItemSelect, localSurvey.questions, focusedQuestionIdx]);

  const getQuestionIcon = (recallItem: TSurveyRecallItem) => {
    switch (recallItem.type) {
      case "question":
        const question = localSurvey.questions.find((question) => question.id === questionId);
        if (question) {
          return questionIconMapping[question?.type as keyof typeof questionIconMapping];
        }
      case "hiddenField":
        return EyeOffIcon;
      case "attributeClass":
        return TagIcon;
    }
  };

  return (
    <div className="absolute z-30 mt-1 flex max-h-60 max-w-[85%] flex-col overflow-y-auto rounded-md border border-slate-300 bg-slate-50 p-3  text-xs ">
      {filteredRecallItems.length === 0 ? (
        <p className="font-medium text-slate-900">There is no information to recall yet 🤷</p>
      ) : (
        <p className="mb-2 font-medium">Recall Information from...</p>
      )}
      <div>
        {filteredRecallItems.map((recallItem, idx) => {
          const isFocused = idx === focusedQuestionIdx;
          const IconComponent = getQuestionIcon(recallItem);
          return (
            <div
              key={recallItem.id}
              className={`flex max-w-full cursor-pointer items-center rounded-md px-3 py-2 ${
                isFocused ? "bg-slate-200" : "hover:bg-slate-200 "
              }`}
              onClick={() => {
                addRecallItem({ id: recallItem.id, label: recallItem.label, type: recallItem.type });
                setShowRecallItemSelect(false);
              }}>
              <div>{IconComponent && <IconComponent className="mr-2 w-4" />}</div>
              <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {getRecallLabel(recallItem.label)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
