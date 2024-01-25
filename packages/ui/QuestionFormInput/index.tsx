"use client";

import { PencilIcon } from "@heroicons/react/24/solid";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { getLocalizedValue } from "@formbricks/lib/utils/i18n";
import {
  extractId,
  extractRecallInfo,
  findRecallInfoById,
  getFallbackValues,
  getRecallQuestions,
  headlineToRecall,
  recallToHeadline,
  replaceRecallInfoWithUnderline,
  useSyncScroll,
} from "@formbricks/lib/utils/recall";
import {
  TI18nString,
  TSurvey,
  TSurveyChoice,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyQuestion,
  TSurveyThankYouCard,
} from "@formbricks/types/surveys";

import { LanguageIndicator } from "../../ee/multiLanguage/components/LanguageIndicator";
import { createI18nString, extractLanguageSymbols } from "../../ee/multiLanguage/utils/i18n";
import FileInput from "../FileInput";
import { Input } from "../Input";
import { Label } from "../Label";
import { FallbackInput } from "./components/FallbackInput";
import RecallQuestionSelect from "./components/RecallQuestionSelect";

interface QuestionFormInputProps {
  id: string;
  localSurvey: TSurvey;
  questionId: string;
  questionIdx: number;
  updateQuestion?: (questionIdx: number, data: Partial<TSurveyQuestion>) => void;
  updateSurvey?: (data: Partial<TSurveyQuestion>) => void;
  updateChoice?: (choiceIdx: number, data: Partial<TSurveyChoice>) => void;
  environmentId: string;
  isInvalid?: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
  maxLength?: number;
  placeholder?: string;
  ref?: RefObject<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

const QuestionFormInput = ({
  id,
  localSurvey,
  questionId,
  questionIdx,
  updateQuestion,
  updateSurvey,
  updateChoice,
  isInvalid,
  environmentId,
  selectedLanguage,
  setSelectedLanguage,
  languages,
  maxLength,
  placeholder,
  onBlur,
}: QuestionFormInputProps) => {
  const isChoice = id.includes("choice");
  let choiceIdx: number | null;

  if (isChoice) {
    const parts = id.split("-");
    if (parts.length > 1) {
      choiceIdx = parseInt(parts[1], 10);
    } else {
      choiceIdx = null;
    }
  } else {
    choiceIdx = null;
  }
  const isThankYouCard = questionId === "end";
  const isWelcomeCard = questionId === "start";

  const question: TSurveyQuestion | TSurveyThankYouCard = isThankYouCard
    ? localSurvey.thankYouCard
    : localSurvey.questions.find((question) => question.id === questionId)!;

  const getPlaceHolder = () => {
    if (isWelcomeCard) return "";
    if (placeholder) return placeholder;
    if (id === "headline") return "Your question here. Recall information with @";
    else if (id === "subheader") return "Your description here. Recall information with @";
  };
  const getQuestionTextBasedOnType = (): TI18nString => {
    if (isChoice && typeof choiceIdx === "number") {
      return (
        ((question as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceSingleQuestion).choices[
          choiceIdx
        ].label as TI18nString) || createI18nString("", extractLanguageSymbols(languages))
      );
    }
    if (isThankYouCard) {
      const thankYouCard = localSurvey.thankYouCard;
      return (
        (thankYouCard[id as keyof typeof thankYouCard] as TI18nString) ||
        createI18nString("", extractLanguageSymbols(languages))
      );
    }
    if (isWelcomeCard) {
      const welcomeCard = localSurvey.welcomeCard;
      return (
        (welcomeCard[id as keyof typeof welcomeCard] as TI18nString) ||
        createI18nString("", extractLanguageSymbols(languages))
      );
    }
    return (
      (question[id as keyof typeof question] as TI18nString) ||
      createI18nString("", extractLanguageSymbols(languages))
    );
  };

  const [text, setText] = useState(getQuestionTextBasedOnType());
  const hasi18n = text._i18n_;

  const [renderedText, setRenderedText] = useState<JSX.Element[]>();

  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(
    questionId === "end"
      ? localSurvey.thankYouCard.imageUrl
        ? true
        : false
      : !!(question as TSurveyQuestion)?.imageUrl
  );
  const [showQuestionSelect, setShowQuestionSelect] = useState(false);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  const [recallQuestions, setRecallQuestions] = useState<TSurveyQuestion[]>(
    getLocalizedValue(text, selectedLanguage).includes("#recall:")
      ? getRecallQuestions(getLocalizedValue(text, selectedLanguage), localSurvey, selectedLanguage)
      : []
  );
  const filteredRecallQuestions = Array.from(new Set(recallQuestions.map((q) => q.id))).map((id) => {
    return recallQuestions.find((q) => q.id === id);
  });
  const [fallbacks, setFallbacks] = useState<{ [type: string]: string }>(
    getLocalizedValue(text, selectedLanguage).includes("/fallback:")
      ? getFallbackValues(getLocalizedValue(text, selectedLanguage))
      : {}
  );

  // Hook to synchronize the horizontal scroll position of highlightContainerRef and inputRef.
  useSyncScroll(highlightContainerRef, inputRef, getLocalizedValue(text, selectedLanguage));

  useEffect(() => {
    // Generates an array of headlines from recallQuestions, replacing nested recall questions with '___' .
    const recallQuestionHeadlines = recallQuestions.flatMap((recallQuestion) => {
      if (!getLocalizedValue(recallQuestion.headline, selectedLanguage).includes("#recall:")) {
        return [recallQuestion.headline[selectedLanguage]];
      }
      const recallQuestionText = (recallQuestion[id as keyof typeof recallQuestion] as string) || "";
      const recallInfo = extractRecallInfo(recallQuestionText);

      if (recallInfo) {
        const recallQuestionId = extractId(recallInfo);
        const recallQuestion = localSurvey.questions.find((question) => question.id === recallQuestionId);

        if (recallQuestion) {
          return [recallQuestionText.replace(recallInfo, `___`)];
        }
      }
      return [];
    });

    // Constructs an array of JSX elements representing segmented parts of text, interspersed with special formatted spans for recall headlines.
    const processInput = (): JSX.Element[] => {
      const parts: JSX.Element[] = [];
      let remainingText = recallToHeadline(text, localSurvey, false, selectedLanguage)[selectedLanguage];
      filterRecallQuestions(remainingText);
      recallQuestionHeadlines.forEach((headline) => {
        const index = remainingText.indexOf("@" + headline);
        if (index !== -1) {
          if (index > 0) {
            parts.push(
              <span key={parts.length} className="whitespace-pre">
                {remainingText.substring(0, index)}
              </span>
            );
          }
          parts.push(
            <span
              className="z-30 flex cursor-pointer items-center justify-center whitespace-pre rounded-md bg-slate-100 text-sm text-transparent"
              key={parts.length}>
              {"@" + headline}
            </span>
          );
          remainingText = remainingText.substring(
            index + getLocalizedValue(headline, selectedLanguage).length + 1
          );
        }
      });
      if (remainingText?.length) {
        parts.push(
          <span className="whitespace-pre" key={parts.length}>
            {remainingText}
          </span>
        );
      }
      return parts;
    };
    setRenderedText(processInput());
  }, [text]);

  useEffect(() => {
    if (fallbackInputRef.current) {
      fallbackInputRef.current.focus();
    }
  }, [showFallbackInput]);

  const checkForRecallSymbol = () => {
    const pattern = /(^|\s)@(\s|$)/;
    if (pattern.test(getLocalizedValue(text, selectedLanguage))) {
      setShowQuestionSelect(true);
    } else {
      setShowQuestionSelect(false);
    }
  };

  // Adds a new recall question to the recallQuestions array, updates fallbacks, modifies the text with recall details.
  const addRecallQuestion = (recallQuestion: TSurveyQuestion) => {
    if (recallQuestion.headline[selectedLanguage].trim() === "") {
      toast.error("Cannot add question with empty headline as recall");
      return;
    }
    let recallQuestionTemp = JSON.parse(JSON.stringify(recallQuestion));
    recallQuestionTemp = replaceRecallInfoWithUnderline(recallQuestionTemp, selectedLanguage);
    setRecallQuestions((prevQuestions) => {
      const updatedQuestions = [...prevQuestions, recallQuestionTemp];
      return updatedQuestions;
    });
    if (!Object.keys(fallbacks).includes(recallQuestion.id)) {
      setFallbacks((prevFallbacks) => ({
        ...prevFallbacks,
        [recallQuestion.id]: "",
      }));
    }
    setShowQuestionSelect(false);
    let modifiedHeadlineWithId = { ...getQuestionTextBasedOnType() };
    modifiedHeadlineWithId[selectedLanguage] = getLocalizedValue(
      modifiedHeadlineWithId,
      selectedLanguage
    ).replace("@", `#recall:${recallQuestion.id}/fallback:# `);
    updateQuestionDetails(getLocalizedValue(modifiedHeadlineWithId, selectedLanguage));
    const modifiedHeadlineWithName = recallToHeadline(
      modifiedHeadlineWithId,
      localSurvey,
      false,
      selectedLanguage
    );
    setText(modifiedHeadlineWithName);
    setShowFallbackInput(true);
  };

  // Filters and updates the list of recall questions based on their presence in the given text, also managing related text and fallback states.
  const filterRecallQuestions = (remainingText: string) => {
    let includedQuestions: TSurveyQuestion[] = [];
    recallQuestions.forEach((recallQuestion) => {
      if (remainingText.includes(`@${getLocalizedValue(recallQuestion.headline, selectedLanguage)}`)) {
        includedQuestions.push(recallQuestion);
      } else {
        const questionToRemove = getLocalizedValue(recallQuestion.headline, selectedLanguage).slice(0, -1);
        const newText = { ...text };
        newText[selectedLanguage] = text[selectedLanguage].replace(`@${questionToRemove}`, "");
        setText(newText);
        updateQuestionDetails(text[selectedLanguage].replace(`@${questionToRemove}`, ""));
        let updatedFallback = { ...fallbacks };
        delete updatedFallback[recallQuestion.id];
        setFallbacks(updatedFallback);
      }
    });
    setRecallQuestions(includedQuestions);
  };

  const addFallback = () => {
    let headlineWithFallback = getQuestionTextBasedOnType();
    filteredRecallQuestions.forEach((recallQuestion) => {
      if (recallQuestion) {
        const recallInfo = findRecallInfoById(
          getLocalizedValue(headlineWithFallback, selectedLanguage),
          recallQuestion!.id
        );
        if (recallInfo) {
          let fallBackValue = fallbacks[recallQuestion.id].trim();
          fallBackValue = fallBackValue.replace(/ /g, "nbsp");
          let updatedFallback = { ...fallbacks };
          updatedFallback[recallQuestion.id] = fallBackValue;
          setFallbacks(updatedFallback);
          headlineWithFallback[selectedLanguage] = getLocalizedValue(
            headlineWithFallback,
            selectedLanguage
          ).replace(recallInfo, `#recall:${recallQuestion?.id}/fallback:${fallBackValue}#`);
          updateQuestionDetails(getLocalizedValue(headlineWithFallback, selectedLanguage));
        }
      }
    });
    setShowFallbackInput(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!isWelcomeCard && (id === "headline" || id === "subheader")) {
      checkForRecallSymbol();
    }
  }, [text]);

  // updation of questions and Thank You Card is done in a different manner, so for question we use updateQuestion and for ThankYouCard we use updateSurvey
  const updateQuestionDetails = (updatedText: string) => {
    let translatedText = {
      ...getQuestionTextBasedOnType(),
      [selectedLanguage]: updatedText,
    };
    if (isChoice && updateChoice && typeof choiceIdx === "number") {
      updateChoice(choiceIdx, { label: translatedText });
    } else if (isThankYouCard || isWelcomeCard) {
      if (updateSurvey) {
        updateSurvey({ [id]: translatedText });
      }
    } else {
      if (updateQuestion) {
        updateQuestion(questionIdx, {
          [id]: translatedText,
        });
      }
    }
  };

  const getLabelById = (id: string) => {
    switch (id) {
      case "headline":
        return "Question";
      case "subheader":
        return "Description";
      case "placeholder":
        return "Placeholder";
      case "buttonLabel":
        return `"Next" Button Label`;
      case "backButtonLabel":
        return `"Back" Button Label`;
      case "lowerLabel":
        return "Lower Label";
      case "upperLabel":
        return "Upper Label";
      default:
        return null;
    }
  };
  const getFileUrl = () => {
    if (isThankYouCard) return localSurvey.thankYouCard.imageUrl;
    else if (isWelcomeCard) return localSurvey.welcomeCard.fileUrl;
    else return question.imageUrl;
  };

  useEffect(() => {
    setText(getQuestionTextBasedOnType());
  }, [localSurvey]);

  return (
    <div className="w-full">
      {getLabelById(id) && (
        <div className="mb-2 mt-3">
          <Label htmlFor={id}>{getLabelById(id)}</Label>
        </div>
      )}
      <div className="flex flex-col gap-6">
        {showImageUploader && id === "headline" && (
          <FileInput
            id="question-image"
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={(url: string[] | undefined) => {
              if (isThankYouCard && updateSurvey && url) {
                updateSurvey({ imageUrl: url[0] });
              } else if (updateQuestion && url) {
                updateQuestion(questionIdx, { imageUrl: url[0] });
              }
            }}
            fileUrl={getFileUrl()}
          />
        )}
        <div className="flex items-center space-x-2">
          <div className="group relative w-full">
            <div className="h-10 w-full"></div>
            <div
              id="wrapper"
              ref={highlightContainerRef}
              className="no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent ">
              {renderedText}
            </div>
            {getLocalizedValue(getQuestionTextBasedOnType(), selectedLanguage).includes("recall:") && (
              <button
                className="fixed right-14 hidden items-center rounded-b-lg bg-slate-100 px-2.5 py-1 text-xs hover:bg-slate-200 group-hover:flex"
                onClick={(e) => {
                  e.preventDefault();
                  setShowFallbackInput(true);
                }}>
                Edit Recall
                <PencilIcon className="ml-2 h-3 w-3" />
              </button>
            )}
            <Input
              key={`${questionId}-${id}`}
              className="absolute top-0 text-black  caret-black"
              placeholder={getPlaceHolder()}
              id={id}
              name={id}
              aria-label={id === "headline" ? "Question" : "Description"}
              autoComplete={showQuestionSelect ? "off" : "on"}
              value={recallToHeadline(text, localSurvey, false, selectedLanguage)[selectedLanguage]}
              ref={inputRef}
              onBlur={onBlur}
              onChange={(e) => {
                let translatedText = {
                  ...getQuestionTextBasedOnType(),
                  [selectedLanguage]: e.target.value,
                };
                setText(recallToHeadline(translatedText, localSurvey, false, selectedLanguage));
                updateQuestionDetails(
                  headlineToRecall(e.target.value, recallQuestions, fallbacks, selectedLanguage)
                );
              }}
              maxLength={maxLength ?? undefined}
              isInvalid={isInvalid && text[selectedLanguage].trim() === ""}
            />
            {hasi18n && languages?.length > 1 && (
              <LanguageIndicator
                selectedLanguage={selectedLanguage}
                languages={languages}
                setSelectedLanguage={setSelectedLanguage}
              />
            )}
            {!showQuestionSelect && showFallbackInput && recallQuestions.length > 0 && (
              <FallbackInput
                filteredRecallQuestions={filteredRecallQuestions}
                fallbacks={fallbacks}
                setFallbacks={setFallbacks}
                fallbackInputRef={fallbackInputRef}
                addFallback={addFallback}
              />
            )}
          </div>
          {id === "headline" && (
            <ImagePlusIcon
              aria-label="Toggle image uploader"
              className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => setShowImageUploader((prev) => !prev)}
            />
          )}
        </div>
      </div>
      {showQuestionSelect && (
        <RecallQuestionSelect
          localSurvey={localSurvey}
          questionId={questionId}
          addRecallQuestion={addRecallQuestion}
          setShowQuestionSelect={setShowQuestionSelect}
          showQuestionSelect={showQuestionSelect}
          inputRef={inputRef}
          recallQuestions={recallQuestions}
          selectedLanguage={selectedLanguage}
        />
      )}
    </div>
  );
};
export default QuestionFormInput;
