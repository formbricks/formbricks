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
} from "lucide-react";
import { RefObject, useEffect, useMemo, useState } from "react";

import { createI18nString, getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { replaceRecallInfoWithUnderline } from "@formbricks/lib/utils/recall";
import {
  TI18nString,
  TSurvey,
  TSurveyHiddenFields,
  TSurveyQuestion,
  TSurveyRecallItem,
} from "@formbricks/types/surveys";

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
  hiddenFields,
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

  // function to remove some specific type of questions (fileUpload, imageSelect etc) from the list of questions to recall from and few other checks
  const filteredRecallItems = useMemo(() => {
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
        return { id: question.id, headline: question.headline };
      });

    const getHiddenFields = () => {
      if (hiddenFields.fieldIds) {
        return hiddenFields.fieldIds
          .filter((hiddenFieldId) => {
            return !recallItemIds.includes(hiddenFieldId);
          })
          .map((hiddenFieldId) => ({
            id: hiddenFieldId,
            headline: createI18nString(
              hiddenFieldId,
              localSurvey.languages.map((lang) => lang.language.code)
            ),
          }));
      }
      return [];
    };
    return [...filteredQuestions, ...getHiddenFields()];
  }, [localSurvey.questions, questionId, recallItemIds]);

  // function to modify headline (recallInfo to corresponding headline)
  const getRecallHeadline = (question: TI18nString): TI18nString => {
    let questionTempHeadline = structuredClone(question);
    questionTempHeadline = replaceRecallInfoWithUnderline(questionTempHeadline, selectedLanguageCode);
    return questionTempHeadline;
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

  const getQuestionIcon = (questionId: string) => {
    const question = localSurvey.questions.find((question) => question.id === questionId);
    if (question) {
      return questionIconMapping[question?.type as keyof typeof questionIconMapping];
    } else return EyeOffIcon;
  };

  return (
    <div className="absolute z-30 mt-1 flex max-w-[85%] flex-col overflow-y-auto rounded-md border border-slate-300 bg-slate-50 p-3  text-xs ">
      {filteredRecallItems.length === 0 ? (
        <p className="font-medium text-slate-900">There is no information to recall yet 🤷</p>
      ) : (
        <p className="mb-2 font-medium">Recall Information from...</p>
      )}
      <div>
        {filteredRecallItems.map((recallItem, idx) => {
          const isFocused = idx === focusedQuestionIdx;
          const IconComponent = getQuestionIcon(recallItem.id);
          return (
            <div
              key={recallItem.id}
              className={`flex max-w-full cursor-pointer items-center rounded-md px-3 py-2 ${
                isFocused ? "bg-slate-200" : "hover:bg-slate-200 "
              }`}
              onClick={() => {
                addRecallItem({ id: recallItem.id, headline: recallItem.headline });
                setShowRecallItemSelect(false);
              }}>
              <div>{IconComponent && <IconComponent className="mr-2 w-4" />}</div>
              <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {getLocalizedValue(getRecallHeadline(recallItem.headline), selectedLanguageCode)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
