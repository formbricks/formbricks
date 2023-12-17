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
  PencilIcon,
} from "@heroicons/react/24/solid";
import { ImagePlusIcon } from "lucide-react";
import { RefObject, useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@formbricks/ui/Input";
import { Button } from "@formbricks/ui/Button";
import {
  extractId,
  checkForRecall,
  extractRecallInfo,
  extractIds,
  findRecallInfoById,
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

  const recallToHeadline = (text): string => {
    while (text.includes("recall:")) {
      const recallInfo = extractRecallInfo(text);
      const recallQuestionId = extractId(recallInfo);

      text = text.replace(
        recallInfo,
        `@${localSurvey.questions.find((question) => question.id === recallQuestionId)?.headline}`
      );
    }

    return text;
  };

  const [showImageUploader, setShowImageUploader] = useState<boolean>(!!question.imageUrl);
  const currentQuestionIdx = useMemo(
    () => localSurvey.questions.findIndex((e) => e.id === question.id),
    [localSurvey, question]
  );
  const [showQuestionSelect, setShowQuestionSelect] = useState(false);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  function getFallbackValues() {
    const headline = question.headline; // Assuming question.headline is the text string
    const pattern = /recall:([A-Za-z0-9]+)\/fallback:([^ ]+)/g;
    let match;
    const fallbacks = {};

    while ((match = pattern.exec(headline)) !== null) {
      const id = match[1];
      const fallbackValue = match[2];
      fallbacks[id] = fallbackValue;
    }

    return fallbacks;
  }
  const [fallbacks, setFallbacks] = useState(
    question.headline.includes("fallback:") ? getFallbackValues() : {}
  );

  const getRecallQuestions = () => {
    const ids = extractIds(question.headline); // Extract IDs from the headline
    let recallQuestionArray: TSurveyQuestion[] = [];
    ids.forEach((questionId) => {
      let recallQuestion = localSurvey.questions.find((question) => question.id === questionId);
      if (recallQuestion) {
        let recallQuestionTemp = { ...recallQuestion };
        recallQuestionTemp.headline = recallToHeadline(recallQuestionTemp.headline);
        recallQuestionArray.push(recallQuestionTemp);
      }
    });
    return recallQuestionArray;
  };
  const [recallQuestions, setrecallQuestions] = useState<TSurveyQuestion[]>(
    question.headline.includes("recall:") ? getRecallQuestions() : []
  );
  const [headline, setheadline] = useState(question.headline);
  const [renderedText, setRenderedText] = useState<JSX.Element[]>();
  const highlightContainerRef = useRef<HTMLInputElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedQuestionIdx, setFocusedQuestionIdx] = useState(0); // New state for managing focus
  const filteredRecallQuestions = Array.from(new Set(recallQuestions.map((q) => q.id))).map((id) => {
    return recallQuestions.find((q) => q.id === id);
  });

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
      const questionId = extractId(recallQuestionTemp.headline);
      recallQuestionTemp.headline = recallQuestionTemp.headline.replace(
        recallInfo,
        `@${localSurvey.questions.find((question) => question.id === questionId)?.headline}`
      );
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

    const modifiedHeadlineWithId = question.headline.replace("@", `recall:${recallQuestion.id}/fallback:`);
    updateQuestion(questionIdx, {
      headline: modifiedHeadlineWithId,
    });

    const modifiedHeadlineWithName = recallToHeadline(modifiedHeadlineWithId);
    setheadline(modifiedHeadlineWithName);
    setShowFallbackInput(true);
    console.log(localSurvey);
  };

  const filterRecallQuestions = (text) => {
    const filteredQuestions = recallQuestions.filter((recallQuestion) =>
      text.includes(`@${recallQuestion.headline}`)
    );
    setrecallQuestions(filteredQuestions);
  };

  useEffect(() => {
    const recallQuestionHeadlines = recallQuestions.map((recallQuestion) => {
      if (!recallQuestion.headline.includes("recall:")) {
        return recallQuestion.headline;
      }
      const recallInfo = extractRecallInfo(recallQuestion.headline);
      const questionId = extractId(recallInfo);

      return recallQuestion.headline.replace(
        recallInfo,
        `@${localSurvey.questions.find((question) => question.id === questionId)?.headline}`
      );
    });
    const processInput = (): JSX.Element[] => {
      const parts: JSX.Element[] = [];
      let remainingText = question.headline;
      remainingText = recallToHeadline(remainingText);
      filterRecallQuestions(remainingText);
      recallQuestionHeadlines.forEach((headline) => {
        const index = remainingText.indexOf("@" + headline);
        if (index !== -1) {
          // Add text before the '@headline'
          if (index > 0) {
            parts.push(<span key={parts.length}>{remainingText.substring(0, index)}</span>);
          }

          // Add '@headline' in the specific span
          parts.push(
            <span className="z-30 cursor-pointer rounded-md bg-slate-100" key={parts.length}>
              {"@" + headline}
            </span>
          );

          // Update remainingText to process the rest of the string
          remainingText = remainingText.substring(index + headline.length + 1);
        }
      });

      // Add any final remaining text
      if (remainingText.length) {
        parts.push(<span key={parts.length}>{remainingText}</span>);
      }

      return parts;
    };

    setRenderedText(processInput());
  }, [headline, question.headline]); // Dependency array, useEffect runs when 'inputValue' changes

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

  const addFallback = () => {
    let headlineWithFallback = question.headline;
    filteredRecallQuestions.forEach((recallQuestion) => {
      const recallInfo = findRecallInfoById(question.headline, recallQuestion!.id);
      console.log(recallInfo);
      headlineWithFallback = headlineWithFallback.replaceAll(
        recallInfo,
        `recall:${recallQuestion?.id}/fallback:${fallbacks[recallQuestion!.id].replace(/ /g, "nbsp")}`
      );
      console.log(headlineWithFallback);
      updateQuestion(questionIdx, {
        headline: headlineWithFallback,
      });
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
    if (fallbackInputRef.current) {
      // Perform actions that depend on fallbackInputRef
      console.log(fallbackInputRef.current); // Now it should not be null
      fallbackInputRef.current.focus(); // Example action
    }
  }, [showFallbackInput]);

  return (
    <div className="mt-3">
      <Label htmlFor="headline">Question</Label>
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
              id="headline"
              name="headline"
              autoComplete={showQuestionSelect ? "off" : "on"}
              value={recallToHeadline(headline)}
              onChange={(e) => {
                checkForRecallSymbol(e.target.value);
                setheadline(recallToHeadline(e.target.value));
                updateQuestion(questionIdx, {
                  headline: headlineToRecall(e.target.value),
                });
              }}
              isInvalid={isInValid && question.headline.trim() === ""}
            />
            {question.headline.includes("recall:") && (
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
                        {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}{" "}
                        {checkForRecall(q.headline, localSurvey)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!showQuestionSelect && showFallbackInput && recallQuestions.length > 0 && (
              <div className="fixed z-30 border bg-white p-4 text-xs">
                <p className="font-medium">Add a fallback, if the data is missing</p>
                {filteredRecallQuestions.map((recallQuestion) => (
                  <div className="mt-4 flex flex-col">
                    <p className="mb-2 text-xs">{recallQuestion!.headline}</p>
                    <div className="flex items-center">
                      <Input
                        className="h-full"
                        ref={fallbackInputRef}
                        id="fallback"
                        value={fallbacks[recallQuestion!.id].replaceAll("nbsp", " ")}
                        onChange={(e) => {
                          const newFallbacks = { ...fallbacks };
                          newFallbacks[recallQuestion!.id] = e.target.value;
                          setFallbacks(newFallbacks);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex w-full justify-end">
                  <Button
                    className=" mt-2 h-full py-2"
                    disabled={Object.values(fallbacks).includes("") || Object.entries(fallbacks).length === 0}
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
