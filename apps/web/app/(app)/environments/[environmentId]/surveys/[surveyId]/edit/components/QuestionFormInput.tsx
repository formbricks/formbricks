"use client";

import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
import { Label } from "@formbricks/ui/Label";
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
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@formbricks/ui/Input";
import { Button } from "@formbricks/ui/Button";
import { toast } from "react-hot-toast";
import {
  extractId,
  extractFallbackValue,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/utils";

interface QuestionFormInputProps {
  localSurvey: TSurvey;
  question: TSurveyQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
  environmentId: string;
  ref?: RefObject<HTMLInputElement>;
}

const QuestionFormInput = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  environmentId,
}: QuestionFormInputProps) => {
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

  const [showImageUploader, setShowImageUploader] = useState<boolean>(!!question.imageUrl);
  const currentQuestionIdx = useMemo(
    () => localSurvey.questions.findIndex((e) => e.id === question.id),
    [localSurvey, question]
  );
  const [showQuestionSelect, setShowQuestionSelect] = useState(false);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  const [fallback, setFallback] = useState(
    question.headline.includes("fallback:") ? extractFallbackValue(question.headline) : null
  );
  const [recallQuestion, setRecallQuestion] = useState<TSurveyQuestion | undefined>(
    question.headline.includes("recall:")
      ? localSurvey.questions.find((q) => {
          return q.id === extractId(question.headline);
        })
      : undefined
  );
  const [headline, setheadline] = useState(question.headline);
  const [renderedText, setRenderedText] = useState<JSX.Element[]>();
  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedQuestionIdx, setFocusedQuestionIdx] = useState(0); // New state for managing focus

  useEffect(() => {
    // Function to synchronize scroll positions
    const syncScrollPosition = () => {
      if (highlightContainerRef.current && inputRef.current) {
        highlightContainerRef.current.scrollLeft = inputRef.current.scrollLeft;
      }
    };

    // Attach the event listener
    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener("scroll", syncScrollPosition);
    }

    // Clean up the event listener
    return () => {
      if (inputElement) {
        inputElement.removeEventListener("scroll", syncScrollPosition);
      }
    };
  }, [headline]); // Add dependencies as required

  const checkforRecallSymbol = (value: string) => {
    console.log(value);
    if (value.includes("@") && !recallQuestion) {
      setShowQuestionSelect(true);
    } else {
      setShowQuestionSelect(false);
    }
  };
  const addRecallQuestion = (question) => {
    setShowQuestionSelect(false);
    const modifiedHeadlineWithId = headline.replace("@", `recall:${question.id}/fallback:`);
    console.log(modifiedHeadlineWithId);
    updateQuestion(questionIdx, {
      headline: modifiedHeadlineWithId,
    });
    const modifiedHeadlineWithName = modifiedHeadlineWithId.replace(
      `recall:${question?.id}/fallback:`,
      `@${question?.headline} `
    );
    setheadline(modifiedHeadlineWithName);
    setShowFallbackInput(true);
  };

  useEffect(() => {
    if (!question.headline.includes("recall:")) setRecallQuestion(undefined);
    if (!recallQuestion) setShowFallbackInput(false);
    const processInput = (): JSX.Element[] => {
      const parts: JSX.Element[] = [];
      let remainingText = headline.replace(
        `recall:${recallQuestion?.id}/fallback:${fallback}`,
        `@${recallQuestion?.headline}`
      );
      while (remainingText.length) {
        const startIndex = remainingText.indexOf("@" + recallQuestion?.headline);
        if (startIndex !== -1) {
          // Add text before the '@' and constant string, if any
          if (startIndex > 0) {
            parts.push(<span key={parts.length}>{remainingText.substring(0, startIndex)}</span>);
          }
          // Add '@' and the constant string
          parts.push(
            <span
              className="z-30 ml-1 cursor-pointer rounded-md bg-slate-100"
              key={parts.length}
              onClick={() => {
                setShowQuestionSelect(true);
              }}>
              {"@" + recallQuestion?.headline}
            </span>
          );
          // Update remaining text
          remainingText = remainingText.substring(startIndex + recallQuestion?.headline.length + 1);
        } else {
          // Add any remaining text and break loop
          parts.push(<span key={parts.length}>{remainingText}</span>);
          break;
        }
      }

      return parts;
    };

    setRenderedText(processInput());
  }, [headline, question.headline, recallQuestion]); // Dependency array, useEffect runs when 'inputValue' changes

  useEffect(() => {
    // Function to handle key presses
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
          event.preventDefault();
          const selectedQuestion = localSurvey.questions[focusedQuestionIdx];
          setRecallQuestion(selectedQuestion);
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

  const addFallback = () => {
    if (!fallback || fallback.trim() === "") {
      return toast.error("Please enter a valid fallback value");
    }
    let headlineWithFallback = question.headline;
    if (question.headline.includes("fallback:")) {
      headlineWithFallback = question.headline.replace(
        `recall:${recallQuestion?.id}/fallback:`,
        `recall:${recallQuestion?.id}/fallback:${fallback}`
      );
    } else {
      headlineWithFallback = question.headline.replace(
        `recall:${recallQuestion?.id}`,
        `recall:${recallQuestion?.id}/fallback:${fallback}`
      );
    }

    updateQuestion(questionIdx, {
      headline: headlineWithFallback,
    });
    setShowFallbackInput(false);
  };

  return (
    <div className="mt-3">
      <Label htmlFor="headline">Question</Label>
      <div className="mt-2 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center space-x-2">
          <div className="relative w-full">
            <div className="h-10 w-full"></div>
            <div
              id="wrapper"
              ref={highlightContainerRef}
              className="no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent ">
              {renderedText}
            </div>
            <Input
              className="absolute top-0"
              autoFocus
              ref={inputRef}
              id="headline"
              name="headline"
              value={headline.replace(
                `recall:${extractId(headline)}/fallback:${fallback}`,
                `@${localSurvey.questions.find((question) => question.id === extractId(headline))?.headline}`
              )}
              onChange={(e) => {
                checkforRecallSymbol(e.target.value);
                console.log(recallQuestion);
                console.log(e.target.value);
                setheadline(
                  e.target.value.replace(
                    `recall:${extractId(headline)}/fallback:${fallback}`,
                    `@${
                      localSurvey.questions.find((question) => question.id === extractId(headline))?.headline
                    }`
                  )
                );
                updateQuestion(questionIdx, {
                  headline: e.target.value.replace(
                    `@${recallQuestion?.headline}`,
                    `recall:${recallQuestion?.id}/fallback:${fallback}`
                  ),
                });
              }}
              isInvalid={isInValid && question.headline.trim() === ""}
            />
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
                          setRecallQuestion(q);
                          addRecallQuestion(q);
                          setShowQuestionSelect(false);
                        }}>
                        {IconComponent && <IconComponent className="mr-2 h-4 w-4" />} {q.headline}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {showFallbackInput && (
              <div className="fixed z-30 flex flex-col border bg-white p-4 text-xs">
                <p className="font-medium">Add a fallback, if the data is missing</p>
                <div className="mt-4 flex items-center">
                  <Input
                    className="h-full"
                    id="fallback"
                    value={fallback}
                    onChange={(e) => {
                      setFallback(e.target.value);
                    }}
                  />
                  <Button
                    className="ml-2 h-full py-2"
                    variant="darkCTA"
                    onClick={(e) => {
                      e.preventDefault();
                      addFallback();
                    }}>
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          <ImagePlusIcon
            aria-label="Toggle image uploader"
            className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
            onClick={() => setShowImageUploader((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  );
};
export default QuestionFormInput;
