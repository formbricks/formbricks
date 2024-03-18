"use client";

import { PencilIcon } from "lucide-react";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useEffect, useMemo, useRef, useState } from "react";
import React from "react";

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
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";

import FileInput from "../FileInput";
import { Input } from "../Input";
import { Label } from "../Label";
import { FallbackInput } from "./components/FallbackInput";
import RecallQuestionSelect from "./components/RecallQuestionSelect";

interface QuestionFormInputProps {
  localSurvey: TSurvey;
  questionId: string;
  questionIdx: number;
  updateQuestion?: (questionIdx: number, data: Partial<TSurveyQuestion>) => void;
  updateSurvey?: (data: Partial<TSurveyQuestion>) => void;
  environmentId: string;
  type: string;
  isInvalid?: boolean;
}

const QuestionFormInput = React.forwardRef(
  (
    {
      localSurvey,
      questionId,
      questionIdx,
      updateQuestion,
      updateSurvey,
      isInvalid,
      environmentId,
      type,
    }: QuestionFormInputProps,
    ref
  ) => {
    const isThankYouCard = questionId === "end";
    const question = useMemo(() => {
      return isThankYouCard
        ? localSurvey.thankYouCard
        : localSurvey.questions.find((question) => question.id === questionId)!;
    }, [isThankYouCard, localSurvey, questionId]);

    const getQuestionTextBasedOnType = (): string => {
      return question[type as keyof typeof question] || "";
    };

    const [text, setText] = useState(getQuestionTextBasedOnType() ?? "");
    const [renderedText, setRenderedText] = useState<JSX.Element[]>();

    const highlightContainerRef = useRef<HTMLInputElement>(null);
    const fallbackInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [showImageUploader, setShowImageUploader] = useState<boolean>(
      questionId === "end"
        ? localSurvey.thankYouCard.imageUrl
          ? true
          : false
        : !!(question as TSurveyQuestion).imageUrl
    );
    const [showQuestionSelect, setShowQuestionSelect] = useState(false);
    const [showFallbackInput, setShowFallbackInput] = useState(false);
    const [recallQuestions, setRecallQuestions] = useState<TSurveyQuestion[]>(
      text.includes("#recall:") ? getRecallQuestions(text, localSurvey) : []
    );
    const filteredRecallQuestions = Array.from(new Set(recallQuestions.map((q) => q.id))).map((id) => {
      return recallQuestions.find((q) => q.id === id);
    });
    const [fallbacks, setFallbacks] = useState<{ [type: string]: string }>(
      text.includes("/fallback:") ? getFallbackValues(text) : {}
    );

    // Hook to synchronize the horizontal scroll position of highlightContainerRef and inputRef.
    useSyncScroll(highlightContainerRef, inputRef, text);

    useEffect(() => {
      // Generates an array of headlines from recallQuestions, replacing nested recall questions with '___' .
      const recallQuestionHeadlines = recallQuestions.flatMap((recallQuestion) => {
        if (!recallQuestion.headline.includes("#recall:")) {
          return [recallQuestion.headline];
        }
        const recallQuestionText = (recallQuestion[type as keyof typeof recallQuestion] as string) || "";
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
        let remainingText: string = text ?? "";
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
    }, [text]);

    useEffect(() => {
      if (fallbackInputRef.current) {
        fallbackInputRef.current.focus();
      }
    }, [showFallbackInput]);

    const checkForRecallSymbol = () => {
      const pattern = /(^|\s)@(\s|$)/;
      if (pattern.test(text)) {
        setShowQuestionSelect(true);
      } else {
        setShowQuestionSelect(false);
      }
    };

    // Adds a new recall question to the recallQuestions array, updates fallbacks, modifies the text with recall details.
    const addRecallQuestion = (recallQuestion: TSurveyQuestion) => {
      let recallQuestionTemp = { ...recallQuestion };
      recallQuestionTemp = replaceRecallInfoWithUnderline(recallQuestionTemp);
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
      const modifiedHeadlineWithId = getQuestionTextBasedOnType().replace(
        "@",
        `#recall:${recallQuestion.id}/fallback:# `
      );
      updateQuestionDetails(modifiedHeadlineWithId);

      const modifiedHeadlineWithName = recallToHeadline(modifiedHeadlineWithId, localSurvey, false);
      setText(modifiedHeadlineWithName);
      setShowFallbackInput(true);
    };

    // Filters and updates the list of recall questions based on their presence in the given text, also managing related text and fallback states.
    const filterRecallQuestions = (text: string) => {
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
      setRecallQuestions(includedQuestions);
    };

    const addFallback = () => {
      let headlineWithFallback = getQuestionTextBasedOnType();
      filteredRecallQuestions.forEach((recallQuestion) => {
        if (recallQuestion) {
          const recallInfo = findRecallInfoById(getQuestionTextBasedOnType(), recallQuestion!.id);
          if (recallInfo) {
            let fallBackValue = fallbacks[recallQuestion.id].trim();
            fallBackValue = fallBackValue.replace(/ /g, "nbsp");
            let updatedFallback = { ...fallbacks };
            updatedFallback[recallQuestion.id] = fallBackValue;
            setFallbacks(updatedFallback);
            headlineWithFallback = headlineWithFallback.replace(
              recallInfo,
              `#recall:${recallQuestion?.id}/fallback:${fallBackValue}#`
            );
            updateQuestionDetails(headlineWithFallback);
          }
        }
      });
      setShowFallbackInput(false);
      inputRef.current?.focus();
    };

    useEffect(() => {
      checkForRecallSymbol();
    }, [text]);

    // updation of questions and Thank You Card is done in a different manner, so for question we use updateQuestion and for ThankYouCard we use updateSurvey
    const updateQuestionDetails = (updatedText: string) => {
      if (isThankYouCard) {
        if (updateSurvey) {
          updateSurvey({ [type]: updatedText });
        }
      } else {
        if (updateQuestion) {
          updateQuestion(questionIdx, {
            [type]: updatedText,
          });
        }
      }
    };

    return (
      <div className="mt-3 w-full">
        <Label htmlFor="headline">{type === "headline" ? "Question" : "Description"}</Label>
        <div className="mt-2 flex flex-col gap-6 overflow-hidden">
          {showImageUploader && type === "headline" && (
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
              fileUrl={
                isThankYouCard ? localSurvey.thankYouCard.imageUrl : (question as TSurveyQuestion).imageUrl
              }
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
              {getQuestionTextBasedOnType().includes("recall:") && (
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
                className="absolute top-0 text-black  caret-black"
                placeholder={
                  type === "headline"
                    ? "Your question here. Recall information with @"
                    : "Your description here. Recall information with @"
                }
                autoFocus
                ref={ref as RefObject<HTMLInputElement> | undefined}
                id={type}
                name={type}
                aria-label={type === "headline" ? "Question" : "Description"}
                autoComplete={showQuestionSelect ? "off" : "on"}
                value={recallToHeadline(text ?? "", localSurvey, false)}
                onChange={(e) => {
                  setText(recallToHeadline(e.target.value ?? "", localSurvey, false));
                  updateQuestionDetails(headlineToRecall(e.target.value, recallQuestions, fallbacks));
                }}
                isInvalid={isInvalid && text.trim() === ""}
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
  }
);
QuestionFormInput.displayName = "QuestionFormInput";

export default QuestionFormInput;
