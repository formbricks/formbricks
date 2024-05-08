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
  TRecallQuestionInfo,
  TSurvey,
  TSurveyHiddenFields,
  TSurveyQuestion,
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

interface RecallQuestionSelectProps {
  localSurvey: TSurvey;
  questionId: string;
  addRecallQuestion: (question: TRecallQuestionInfo) => void;
  setShowQuestionSelect: (show: boolean) => void;
  showQuestionSelect: boolean;
  inputRef: RefObject<HTMLInputElement>;
  recallQuestions: TRecallQuestionInfo[];
  selectedLanguageCode: string;
  hiddenFields: TSurveyHiddenFields;
}

export default function RecallQuestionSelect({
  localSurvey,
  questionId,
  addRecallQuestion,
  setShowQuestionSelect,
  showQuestionSelect,
  inputRef,
  recallQuestions,
  selectedLanguageCode,
  hiddenFields,
}: RecallQuestionSelectProps) {
  const [focusedQuestionIdx, setFocusedQuestionIdx] = useState(0); // New state for managing focus
  const isNotAllowedQuestionType = (question: TSurveyQuestion) => {
    return (
      question.type === "fileUpload" ||
      question.type === "cta" ||
      question.type === "consent" ||
      question.type === "pictureSelection" ||
      question.type === "cal" ||
      question.type === "matrix"
    );
  };

  const recallQuestionIds = useMemo(() => {
    return recallQuestions.map((recallQuestion) => recallQuestion.id);
  }, [recallQuestions]);

  // function to remove some specific type of questions (fileUpload, imageSelect etc) from the list of questions to recall from and few other checks
  const filteredRecallQuestions = useMemo(() => {
    const idx =
      questionId === "end"
        ? localSurvey.questions.length
        : localSurvey.questions.findIndex((recallQuestion) => recallQuestion.id === questionId);
    const filteredQuestions = localSurvey.questions
      .filter((question, index) => {
        const notAllowed = isNotAllowedQuestionType(question);
        return (
          !recallQuestionIds.includes(question.id) && !notAllowed && question.id !== questionId && idx > index
        );
      })
      .map((question) => {
        return { id: question.id, headline: question.headline };
      });
    return filteredQuestions;
  }, [localSurvey.questions, questionId, recallQuestionIds]);

  const hiddenFieldsArray = hiddenFields.fieldIds
    ? hiddenFields.fieldIds.map((hiddenField) => {
        return {
          id: hiddenField,
          headline: createI18nString(
            hiddenField,
            localSurvey.languages.map((lang) => lang.language.code)
          ),
        };
      })
    : [];

  // function to modify headline (recallInfo to corresponding headline)
  const getRecallHeadline = (question: TI18nString): TI18nString => {
    let questionTempHeadline = structuredClone(question);
    questionTempHeadline = replaceRecallInfoWithUnderline(questionTempHeadline, selectedLanguageCode);
    return questionTempHeadline;
  };

  // function to handle key press
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (showQuestionSelect) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setFocusedQuestionIdx(
            (prevIdx) => (prevIdx + 1) % [...filteredRecallQuestions, ...hiddenFieldsArray].length
          );
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setFocusedQuestionIdx((prevIdx) =>
            prevIdx === 0 ? [...filteredRecallQuestions, ...hiddenFieldsArray].length - 1 : prevIdx - 1
          );
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          const selectedQuestion = [...filteredRecallQuestions, ...hiddenFieldsArray][focusedQuestionIdx];
          setShowQuestionSelect(false);
          if (!selectedQuestion) return;
          addRecallQuestion(selectedQuestion);
        }
      }
    };

    const inputElement = inputRef.current;
    inputElement?.addEventListener("keydown", handleKeyPress);

    return () => {
      inputElement?.removeEventListener("keydown", handleKeyPress);
    };
  }, [showQuestionSelect, localSurvey.questions, focusedQuestionIdx]);

  const getQuestionIcon = (questionId: string) => {
    const question = localSurvey.questions.find((question) => question.id === questionId);
    if (question) {
      return questionIconMapping[question?.type as keyof typeof questionIconMapping];
    } else return EyeOffIcon;
  };

  return (
    <div className="absolute z-30 mt-1 flex max-w-[85%] flex-col overflow-y-auto rounded-md border border-slate-300 bg-slate-50 p-3  text-xs ">
      {filteredRecallQuestions.length === 0 ? (
        <p className="font-medium text-slate-900">There is no information to recall yet 🤷</p>
      ) : (
        <p className="mb-2 font-medium">Recall Information from...</p>
      )}
      <div>
        {[...filteredRecallQuestions, ...hiddenFieldsArray].map((q, idx) => {
          const isFocused = idx === focusedQuestionIdx;
          const IconComponent = getQuestionIcon(q.id);
          return (
            <div
              key={q.id}
              className={`flex max-w-full cursor-pointer items-center rounded-md px-3 py-2 ${
                isFocused ? "bg-slate-200" : "hover:bg-slate-200 "
              }`}
              onClick={() => {
                addRecallQuestion({ id: q.id, headline: q.headline });
                setShowQuestionSelect(false);
              }}>
              <div>{IconComponent && <IconComponent className="mr-2 w-4" />}</div>
              <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {getLocalizedValue(getRecallHeadline(q.headline), selectedLanguageCode)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
