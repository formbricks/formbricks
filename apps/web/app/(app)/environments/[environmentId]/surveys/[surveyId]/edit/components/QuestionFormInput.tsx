"use client";

import FallbackInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/FallbackInput";
import RecallQuestionSelect from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/RecallQuestionSelect";
import { PencilIcon } from "@heroicons/react/24/solid";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useEffect, useRef, useState } from "react";

import { recallToHeadline, replaceRecallInfoWithUnderline } from "@formbricks/lib/utils/recall";
import { extractId, extractIds, extractRecallInfo, findRecallInfoById } from "@formbricks/lib/utils/recall";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface QuestionFormInputProps {
  localSurvey: TSurvey;
  questionId: string;
  questionIdx: number;
  updateQuestion: any;
  environmentId: string;
  type: string;
  isInValid?: boolean;
  ref?: RefObject<HTMLInputElement>;
}

const QuestionFormInput = ({
  localSurvey,
  questionId,
  questionIdx,
  updateQuestion,
  isInValid,
  environmentId,
  type,
}: QuestionFormInputProps) => {
  const isThankYouCard = questionId === "end";
  const question = isThankYouCard
    ? localSurvey.thankYouCard
    : localSurvey.questions.find((question) => question.id === questionId)!;

  function getFallbackValues() {
    const text = question[type];
    const pattern = /recall:([A-Za-z0-9]+)\/fallback:([\S*]+)/g;
    let match;
    const fallbacks = {};

    while ((match = pattern.exec(text)) !== null) {
      const id = match[1];
      const fallbackValue = match[2];
      fallbacks[id] = fallbackValue;
    }
    return fallbacks;
  }

  const getRecallQuestions = () => {
    const ids = extractIds(question[type]);
    let recallQuestionArray: TSurveyQuestion[] = [];
    ids.forEach((questionId) => {
      let recallQuestion = localSurvey.questions.find((question) => question.id === questionId);
      if (recallQuestion) {
        let recallQuestionTemp = { ...recallQuestion };
        recallQuestionTemp = replaceRecallInfoWithUnderline(recallQuestionTemp);
        recallQuestionArray.push(recallQuestionTemp);
      }
    });
    return recallQuestionArray;
  };
  const [text, setText] = useState(question[type] ?? "");
  const [renderedText, setRenderedText] = useState<JSX.Element[]>();
  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(
    questionId === "end" ? false : !!(question as TSurveyQuestion).imageUrl
  );
  const [showQuestionSelect, setShowQuestionSelect] = useState(false);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  const [recallQuestions, setrecallQuestions] = useState<TSurveyQuestion[]>(
    question[type]?.includes("recall:") ? getRecallQuestions() : []
  );
  const filteredRecallQuestions = Array.from(new Set(recallQuestions.map((q) => q.id))).map((id) => {
    return recallQuestions.find((q) => q.id === id);
  });
  const [fallbacks, setFallbacks] = useState<{ [type: string]: string }>(
    question[type]?.includes("fallback:") ? getFallbackValues() : {}
  );

  useEffect(() => {
    const syncScrollPosition = () => {
      if (highlightContainerRef.current && inputRef.current) {
        highlightContainerRef.current.scrollLeft = inputRef.current.scrollLeft;
      }
    };
    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener("scroll", syncScrollPosition);
    }
    return () => {
      if (inputElement) {
        inputElement.removeEventListener("scroll", syncScrollPosition);
      }
    };
  }, [text]);

  useEffect(() => {
    const recallQuestionHeadlines = recallQuestions.map((recallQuestion) => {
      if (!recallQuestion.headline.includes("recall:")) {
        return recallQuestion.headline;
      }
      const recallInfo = extractRecallInfo(recallQuestion[type]);
      if (recallInfo) {
        const recallQuestionId = extractId(recallInfo);
        const recallQuestion = localSurvey.questions.find((question) => question.id === recallQuestionId);
        if (recallQuestion) {
          return recallQuestion[type].replace(recallInfo, `___`);
        }
      }
    });
    const processInput = (): JSX.Element[] => {
      const parts: JSX.Element[] = [];
      let remainingText: string = question[type] ?? "";
      remainingText = recallToHeadline(remainingText, localSurvey, false);
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
          remainingText = remainingText.substring(index + headline.length + 1);
        }
      });
      if (remainingText.length) {
        parts.push(
          <span className="whitespace-pre" key={parts.length}>
            {remainingText}
          </span>
        );
      }

      return parts;
    };

    setRenderedText(processInput());
  }, [text, question[type]]);

  useEffect(() => {
    if (fallbackInputRef.current) {
      fallbackInputRef.current.focus();
    }
  }, [showFallbackInput]);

  const checkForRecallSymbol = () => {
    const pattern = /(^|\s)@(\s|$)/;

    if (pattern.test(question[type])) {
      setShowQuestionSelect(true);
    } else {
      setShowQuestionSelect(false);
    }
  };
  const addRecallQuestion = (recallQuestion: TSurveyQuestion) => {
    let recallQuestionTemp = { ...recallQuestion };
    recallQuestionTemp = replaceRecallInfoWithUnderline(recallQuestionTemp);
    setrecallQuestions((prevQuestions) => {
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
    const modifiedHeadlineWithId = question[type].replace("@", `recall:${recallQuestion.id}/fallback: `);
    updateQuestionDetails(modifiedHeadlineWithId);

    const modifiedHeadlineWithName = recallToHeadline(modifiedHeadlineWithId, localSurvey, false);
    setText(modifiedHeadlineWithName);
    setShowFallbackInput(true);
  };

  const filterRecallQuestions = (text) => {
    let includedQuestions: TSurveyQuestion[] = [];
    recallQuestions.forEach((recallQuestion) => {
      if (text.includes(`@${recallQuestion.headline}`)) {
        includedQuestions.push(recallQuestion);
      } else {
        const questionToRemove = recallQuestion.headline.slice(0, -1);
        const newText = text.replace(`@${questionToRemove}`, "");
        setText(newText);
        updateQuestionDetails(newText);
        let updatedFallback = { ...fallbacks };
        delete updatedFallback[recallQuestion.id];
        setFallbacks(updatedFallback);
      }
    });

    setrecallQuestions(includedQuestions);
  };

  const addFallback = () => {
    let headlineWithFallback = question[type];
    filteredRecallQuestions.forEach((recallQuestion) => {
      if (recallQuestion) {
        const recallInfo = findRecallInfoById(question[type], recallQuestion!.id);
        if (recallInfo) {
          let fallBackValue = fallbacks[recallQuestion.id].trim();
          fallBackValue = fallBackValue.replace(/ /g, "nbsp");
          let updatedFallback = { ...fallbacks };
          updatedFallback[recallQuestion.id] = fallBackValue;
          setFallbacks(updatedFallback);
          headlineWithFallback = headlineWithFallback.replaceAll(
            recallInfo,
            `recall:${recallQuestion?.id}/fallback:${fallBackValue}`
          );
          updateQuestionDetails(headlineWithFallback);
        }
      }
    });
    setShowFallbackInput(false);
    inputRef.current?.focus();
  };

  const headlineToRecall = (text): string => {
    recallQuestions.forEach((recallQuestion) => {
      const recallInfo = `recall:${recallQuestion.id}/fallback:${fallbacks[recallQuestion.id]}`;
      text = text.replace(`@${recallQuestion.headline}`, recallInfo);
    });
    return text;
  };

  useEffect(() => {
    checkForRecallSymbol();
  }, [question[type]]);

  function updateQuestionDetails(updatedText) {
    if (isThankYouCard) {
      updateQuestion({ [type]: updatedText });
    } else {
      updateQuestion(questionIdx, {
        [type]: updatedText,
      });
    }
  }

  return (
    <div className="mt-3 w-full">
      <Label htmlFor="headline">{type === "headline" ? "Question" : "Description"}</Label>
      <div className="mt-2 flex flex-col gap-6 overflow-hidden">
        {showImageUploader && (
          <FileInput
            id="question-image"
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={(url: string[]) => {
              updateQuestion(questionIdx, { imageUrl: url[0] });
            }}
            fileUrl={isThankYouCard ? "" : (question as TSurveyQuestion).imageUrl}
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
            {question[type]?.includes("recall:") && (
              <div
                className="fixed right-14 hidden items-center rounded-b-lg bg-slate-100 px-2.5 py-1 text-xs hover:bg-slate-200 group-hover:flex"
                onClick={() => {
                  setShowFallbackInput(true);
                }}>
                Edit Recall
                <PencilIcon className="ml-2 h-3 w-3" />
              </div>
            )}
            <Input
              className="absolute top-0 text-black  caret-black"
              autoFocus
              ref={inputRef}
              id={type}
              name={type}
              autoComplete={showQuestionSelect ? "off" : "on"}
              value={recallToHeadline(text ?? "", localSurvey, false)}
              onChange={(e) => {
                setText(recallToHeadline(e.target.value ?? "", localSurvey, false));
                updateQuestionDetails(headlineToRecall(e.target.value));
              }}
              isInvalid={isInValid && question[type].trim() === ""}
            />

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
          {type === "headline" && (
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
        />
      )}
    </div>
  );
};
export default QuestionFormInput;
