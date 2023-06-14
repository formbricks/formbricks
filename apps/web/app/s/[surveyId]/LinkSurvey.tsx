"use client";

import FormbricksSignature from "@/components/preview/FormbricksSignature";
import Progress from "@/components/preview/Progress";
import QuestionConditional from "@/components/preview/QuestionConditional";
import ThankYouCard from "@/components/preview/ThankYouCard";
import ContentWrapper from "@/components/shared/ContentWrapper";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { createDisplay, markDisplayResponded } from "@formbricks/lib/clientDisplay/display";
import { createResponse, updateResponse } from "@formbricks/lib/clientResponse/response";
import { cn } from "@formbricks/lib/cn";
import { QuestionType, type Logic, type Question } from "@formbricks/types/questions";
import type { Survey } from "@formbricks/types/surveys";
import { Confetti } from "@formbricks/ui";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useEffect, useState, useCallback } from "react";

type EnhancedSurvey = Survey & {
  brandColor: string;
  formbricksSignature: boolean;
};

interface LinkSurveyProps {
  survey: EnhancedSurvey;
}

export default function LinkSurvey({ survey }: LinkSurveyProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [finished, setFinished] = useState(false);
  const [loadingElement, setLoadingElement] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);

  const URLParams = new URLSearchParams(window.location.search);
  const isPreview = URLParams.get("preview") === "true";
  const hasFirstQuestionPrefill = URLParams.has(survey.questions[0].id);
  const firstQuestionPrefill = hasFirstQuestionPrefill ? URLParams.get(survey.questions[0].id) : null;

  useEffect(() => {
    if (survey) {
      setCurrentQuestion(survey.questions[0]);

      if (isPreview) return;

      // create display
      createDisplay(
        { surveyId: survey.id },
        `${window.location.protocol}//${window.location.host}`,
        survey.environmentId
      ).then((display) => {
        setDisplayId(display.id);
      });
    }
  }, [survey, isPreview]);

  const calculateProgress = useCallback((currentQuestion, survey) => {
    const elementIdx = survey.questions.findIndex((e) => e.id === currentQuestion.id);
    return elementIdx / survey.questions.length;
  }, []);

  useEffect(() => {
    if (currentQuestion && survey) {
      setProgress(calculateProgress(currentQuestion, survey));
    }

    // function calculateProgress(currentQuestion, survey) {
    //   const elementIdx = survey.questions.findIndex((e) => e.id === currentQuestion.id);
    //   return elementIdx / survey.questions.length;
    // }
  }, []);

  function evaluateCondition(logic: Logic, answerValue: any): boolean {
    switch (logic.condition) {
      case "equals":
        return (
          (Array.isArray(answerValue) && answerValue.length === 1 && answerValue.includes(logic.value)) ||
          answerValue.toString() === logic.value
        );
      case "notEquals":
        return answerValue !== logic.value;
      case "lessThan":
        return logic.value !== undefined && answerValue < logic.value;
      case "lessEqual":
        return logic.value !== undefined && answerValue <= logic.value;
      case "greaterThan":
        return logic.value !== undefined && answerValue > logic.value;
      case "greaterEqual":
        return logic.value !== undefined && answerValue >= logic.value;
      case "includesAll":
        return (
          Array.isArray(answerValue) &&
          Array.isArray(logic.value) &&
          logic.value.every((v) => answerValue.includes(v))
        );
      case "includesOne":
        return (
          Array.isArray(answerValue) &&
          Array.isArray(logic.value) &&
          logic.value.some((v) => answerValue.includes(v))
        );
      case "submitted":
        if (typeof answerValue === "string") {
          return answerValue !== "dismissed" && answerValue !== "" && answerValue !== null;
        } else if (Array.isArray(answerValue)) {
          return answerValue.length > 0;
        } else if (typeof answerValue === "number") {
          return answerValue !== null;
        }
        return false;
      case "skipped":
        return (
          (Array.isArray(answerValue) && answerValue.length === 0) ||
          answerValue === "" ||
          answerValue === null ||
          answerValue === "dismissed"
        );
      default:
        return false;
    }
  }

  const getNextQuestionId = (answer: any): string => {
    const activeQuestionId: string = currentQuestion?.id || "";
    const currentQuestionIndex = survey.questions.findIndex((q) => q.id === currentQuestion?.id);
    if (currentQuestionIndex === -1) throw new Error("Question not found");

    const answerValue = answer[activeQuestionId];

    if (currentQuestion?.logic && currentQuestion?.logic.length > 0) {
      for (let logic of currentQuestion.logic) {
        if (!logic.destination) continue;

        if (evaluateCondition(logic, answerValue)) {
          return logic.destination;
        }
      }
    }
    if (lastQuestion) return "end";
    return survey.questions[currentQuestionIndex + 1].id;
  };

  const restartSurvey = () => {
    setCurrentQuestion(survey.questions[0]);
    setProgress(0);
    setFinished(false);
  };

  const submitResponse = async (data: { [x: string]: any }) => {
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(data);

    const finished = nextQuestionId === "end";
    // build response
    const responseRequest = {
      surveyId: survey.id,
      response: { finished, data },
    };
    if (!responseId && !isPreview) {
      const response = await createResponse(
        responseRequest,
        `${window.location.protocol}//${window.location.host}`,
        survey.environmentId
      );
      if (displayId) {
        markDisplayResponded(
          displayId,
          `${window.location.protocol}//${window.location.host}`,
          survey.environmentId
        );
      }
      setResponseId(response.id);
    } else if (responseId && !isPreview) {
      await updateResponse(
        responseRequest,
        responseId,
        `${window.location.protocol}//${window.location.host}`,
        survey.environmentId
      );
    }

    setLoadingElement(false);

    if (!finished && nextQuestionId !== "end") {
      const question = survey.questions.find((q) => q.id === nextQuestionId);

      if (!question) throw new Error("Question not found");

      setCurrentQuestion(question);
      // setCurrentQuestion(survey.questions[questionIdx + 1]);
    } else {
      setProgress(1);
      setFinished(true);
    }
  };

  const checkValidity = useCallback((question: Question, answer: any): boolean => {
    if (question.required && (!answer || answer === "")) return false;
    switch (question.type) {
      case QuestionType.OpenText: {
        return true;
      }
      case QuestionType.MultipleChoiceSingle: {
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (!question.choices.find((o) => o.label === answer)) return false;
          return true;
        }
        return true;
      }
      case QuestionType.MultipleChoiceMulti: {
        answer = answer.split(",");
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (!answer.every((a: string) => question.choices.find((o) => o.label === a))) return false;
          return true;
        }
        return true;
      }
      case QuestionType.NPS: {
        const answerNumber = Number(answer);
        if (answerNumber < 0 || answerNumber > 10) return false;
        return true;
      }
      case QuestionType.CTA: {
        if (question.required && answer === "dismissed") return false;
        if (answer !== "clicked" && answer !== "dismissed") return false;
        return true;
      }
      case QuestionType.Rating: {
        const answerNumber = Number(answer);
        if (answerNumber < 1 || answerNumber > question.range) return false;
        return true;
      }
      default:
        return false;
    }
  }, []);

  const createAnswer = useCallback((question: Question, answer: string): string | number | string[] => {
    switch (question.type) {
      case QuestionType.OpenText:
      case QuestionType.MultipleChoiceSingle:
      case QuestionType.CTA: {
        return answer;
      }

      case QuestionType.Rating:
      case QuestionType.NPS: {
        return Number(answer);
      }

      case QuestionType.MultipleChoiceMulti: {
        let ansArr = answer.split(",");
        const hasOthers = question.choices[question.choices.length - 1].id === "other";
        if (!hasOthers) return ansArr;

        // answer can be "a,b,c,d" and options can be a,c,others so we are filtering out the options that are not in the options list and sending these non-existing values as a single string(representing others) like "a", "c", "b,d"
        const options = question.choices.map((o) => o.label);
        const others = ansArr.filter((a: string) => !options.includes(a));
        if (others.length > 0) ansArr = ansArr.filter((a: string) => options.includes(a));
        if (others.length > 0) ansArr.push(others.join(","));
        return ansArr;
      }

      default:
        return "dismissed";
    }
  }, []);

  useEffect(() => {
    if (hasFirstQuestionPrefill) {
      const firstQuestionId = survey.questions[0].id;
      const question = survey.questions.find((q) => q.id === firstQuestionId);
      if (!question) throw new Error("Question not found");
      if (!currentQuestion) return;

      const isValid = checkValidity(question, firstQuestionPrefill);
      if (!isValid) return;
      const answer = createAnswer(question, firstQuestionPrefill || "");
      const answerObj = { [firstQuestionId]: answer };
      submitResponse(answerObj);
    }
  }, [currentQuestion, firstQuestionPrefill]);

  if (!currentQuestion) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const lastQuestion = currentQuestion.id === survey.questions[survey.questions.length - 1].id;

  return (
    <>
      <div
        className={cn(
          loadingElement && "animate-pulse opacity-60",
          "flex h-full flex-1 items-center overflow-y-auto bg-white"
        )}>
        <ContentWrapper className="w-full md:max-w-lg">
          {isPreview && (
            <div className="absolute left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
              <div className="w-20"></div>
              <div className="">Survey Preview 👀</div>
              <button
                className="flex items-center rounded-full bg-slate-500 px-3 py-1 hover:bg-slate-400"
                onClick={() => restartSurvey()}>
                Restart <ArrowPathIcon className="ml-2 h-4 w-4" />
              </button>
            </div>
          )}
          {finished ? (
            <div>
              <Confetti colors={[survey.brandColor, "#eee"]} />
              <ThankYouCard
                headline={survey.thankYouCard.headline || "Thank you!"}
                subheader={survey.thankYouCard.subheader || "Your response has been recorded."}
                brandColor={survey.brandColor}
              />
            </div>
          ) : (
            <QuestionConditional
              question={currentQuestion}
              brandColor={survey.brandColor}
              lastQuestion={lastQuestion}
              onSubmit={submitResponse}
            />
          )}
        </ContentWrapper>
      </div>
      <div className="top-0 z-10 w-full border-b bg-white">
        <div className="mx-auto max-w-md space-y-6 p-6">
          <Progress progress={progress} brandColor={survey.brandColor} />
          {survey.formbricksSignature && <FormbricksSignature />}
        </div>
      </div>
    </>
  );
}
