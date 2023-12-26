"use client";

import FallbackInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/FallbackInput";
import RecallQuestionSelect from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/RecallQuestionSelect";
import { PencilIcon } from "@heroicons/react/24/solid";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useEffect, useRef, useState } from "react";

import { extractId, extractIds, extractRecallInfo, findRecallInfoById } from "@formbricks/lib/utils/recall";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface QuestionFormInputProps {
  localSurvey: TSurvey;
  question: TSurveyQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  environmentId: string;
  type: string;
  isInValid?: boolean;
  ref?: RefObject<HTMLInputElement>;
}

const QuestionFormInput = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  environmentId,
  type,
}: QuestionFormInputProps) => {
  const recallToHeadline = (text): string => {
    while (text.includes("recall:")) {
      const recallInfo = extractRecallInfo(text);
      if (recallInfo) {
        const recallQuestionId = extractId(recallInfo);
        const recallQuestion = localSurvey.questions.find((question) => question.id === recallQuestionId);
        const recallText = recallQuestion ? recallQuestion.headline : "";
        text = text.replace(recallInfo, `@${recallText}`);
      }
    }
    return text;
  };

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
        recallQuestionTemp.headline = recallToHeadline(recallQuestionTemp.headline ?? "");
        recallQuestionArray.push(recallQuestionTemp);
      }
    });
    return recallQuestionArray;
  };

  const [text, setText] = useState(question[type]);
  const [renderedText, setRenderedText] = useState<JSX.Element[]>();
  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(!!question.imageUrl);
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
        const recallText = recallQuestion ? recallQuestion.headline : "";
        if (recallQuestion) {
          return recallQuestion[type].replace(recallInfo, `@${recallText}`);
        }
      }
    });
    const processInput = (): JSX.Element[] => {
      const parts: JSX.Element[] = [];
      let remainingText: string = question[type] ?? "";
      remainingText = recallToHeadline(remainingText);
      filterRecallQuestions(remainingText);
      recallQuestionHeadlines.forEach((headline) => {
        console.log(addBlankSpaces(remainingText));
        const index = addBlankSpaces(remainingText).indexOf("   " + "@" + headline + "   ");
        if (index !== -1) {
          if (index > 0) {
            parts.push(
              <span key={parts.length} className="whitespace-pre">
                {remainingText.substring(0, index)}
              </span>
            );
          }
          parts.push(
            <span className="z-30 cursor-pointer whitespace-pre rounded-md bg-slate-100" key={parts.length}>
              {"  " + "@" + headline + "  "}
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

  const checkForRecallSymbol = (value: string) => {
    const pattern = /(^|\s)@(\s|$)/;

    if (pattern.test(value)) {
      setShowQuestionSelect(true);
    } else {
      setShowQuestionSelect(false);
    }
  };

  const addRecallQuestion = (recallQuestion: TSurveyQuestion) => {
    const recallQuestionTemp = { ...recallQuestion };
    while (recallQuestionTemp.headline.includes("recall:")) {
      const recallInfo = extractRecallInfo(recallQuestionTemp.headline);
      if (recallInfo) {
        const recallQuestionId = extractId(recallQuestionTemp.headline);
        const recallQuestion = localSurvey.questions.find((question) => question.id === recallQuestionId);
        const recallText = recallQuestion ? recallQuestion.headline : ""; // Using type dynamically
        recallQuestionTemp.headline = recallQuestionTemp.headline.replace(recallInfo, `@${recallText}`);
      }
    }

    setrecallQuestions((prevQuestions) => {
      const updatedQuestions = [...prevQuestions, recallQuestionTemp];
      return updatedQuestions;
    });
    if (!Object.keys(fallbacks).includes(recallQuestion.id)) {
      // Update the fallbacks state
      setFallbacks((prevFallbacks) => ({
        ...prevFallbacks,
        [recallQuestion.id]: "",
      }));
    }

    setShowQuestionSelect(false);
    const modifiedHeadlineWithId = question[type].replace("@", `recall:${recallQuestion.id}/fallback: `);
    updateQuestion(questionIdx, {
      [type]: modifiedHeadlineWithId,
    });
    const modifiedHeadlineWithName = recallToHeadline(modifiedHeadlineWithId);
    setText(modifiedHeadlineWithName);
    setShowFallbackInput(true);
  };

  const filterRecallQuestions = (text) => {
    let includedQuestions: TSurveyQuestion[] = [];
    text = addBlankSpaces(text);
    recallQuestions.forEach((recallQuestion) => {
      if (text.includes(`   @${recallQuestion.headline}    `)) {
        includedQuestions.push(recallQuestion);
      } else {
        const questionToRemove = recallQuestion.headline;
        const newText = text.replace(`   @${questionToRemove}   `, "");
        setText(newText);
        updateQuestion(questionIdx, {
          [type]: newText,
        });
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
          updateQuestion(questionIdx, {
            [type]: headlineWithFallback,
          });
        }
      }
    });
    setShowFallbackInput(false);
    inputRef.current?.focus();
  };

  const headlineToRecall = (text): string => {
    recallQuestions.forEach((recallQuestion) => {
      const recallInfo = `recall:${recallQuestion.id}/fallback:${fallbacks[recallQuestion.id]}`;
      text = text.replace(`   @${recallQuestion.headline}   `, recallInfo);
    });
    return text;
  };

  const addBlankSpaces = (text) => {
    recallQuestions.forEach((recallquestion) => {
      if (!text.includes(`   @${recallquestion.headline}   `)) {
        text = text.replace(`@${recallquestion.headline}`, `   @${recallquestion.headline}   `);
      }
    });
    return text;
  };

  return (
    <div className="mt-3 w-full">
      <Label htmlFor="headline">{type === "headline" ? "question" : "Description"}</Label>
      <div className="mt-2 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center space-x-2">
          <div className="group relative w-full">
            <div className="h-10 w-full"></div>
            <div
              id="wrapper"
              ref={highlightContainerRef}
              className="no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full space-x-1 overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent ">
              {renderedText}
            </div>
            <Input
              className="absolute top-0"
              autoFocus
              ref={inputRef}
              id={type}
              name={type}
              autoComplete={showQuestionSelect ? "off" : "on"}
              value={addBlankSpaces(recallToHeadline(text ?? ""))}
              onChange={(e) => {
                checkForRecallSymbol(e.target.value);
                setText(recallToHeadline(e.target.value ?? ""));
                updateQuestion(questionIdx, {
                  [type]: headlineToRecall(e.target.value),
                });
              }}
              isInvalid={isInValid && question[type].trim() === ""}
            />
            {question[type]?.includes("recall:") && (
              <div
                className="fixed right-10 hidden items-center rounded-lg border bg-white p-2 py-3 text-sm text-slate-800 group-hover:flex"
                onClick={() => {
                  setShowFallbackInput(true);
                }}>
                Edit Fallback
                <PencilIcon className="ml-2 h-3 w-3 text-slate-800" />
              </div>
            )}

            {showImageUploader && (
              <FileInput
                id="question-image"
                allowedFileExtensions={["png", "jpeg", "jpg"]}
                environmentId={environmentId}
                onFileUpload={(url: string[]) => {
                  updateQuestion(questionIdx, { imageUrl: url[0] });
                }}
                fileUrl={question.imageUrl}
              />
            )}
            {showQuestionSelect && (
              <RecallQuestionSelect
                localSurvey={localSurvey}
                question={question}
                addRecallQuestion={addRecallQuestion}
                setShowQuestionSelect={setShowQuestionSelect}
                showQuestionSelect={showQuestionSelect}
                inputRef={inputRef}
                recallQuestions={recallQuestions}
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
          {type === "headline" && (
            <ImagePlusIcon
              aria-label="Toggle image uploader"
              className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => setShowImageUploader((prev) => !prev)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
export default QuestionFormInput;
