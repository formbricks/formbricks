import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";
import { createDisplay, markDisplayResponded } from "@formbricks/lib/client/display";
import { createResponse, updateResponse } from "@formbricks/lib/client/response";
import { QuestionType, type Logic, type Question } from "@formbricks/types/questions";
import { TResponseInput } from "@formbricks/types/v1/responses";
import { useState, useEffect, useCallback } from "react";
import type { Survey } from "@formbricks/types/surveys";
import { useRouter } from "next/navigation";
import { useGetOrCreatePerson } from "../people/people";
import { Response } from "@formbricks/types/js";
import { set } from "lodash";

export const useLinkSurvey = (surveyId: string) => {
  const { data, error, mutate, isLoading } = useSWR(`/api/v1/client/surveys/${surveyId}`, fetcher);

  return {
    survey: data,
    isLoadingSurvey: isLoading,
    isErrorSurvey: error,
    mutateSurvey: mutate,
  };
};

export const useLinkSurveyUtils = (survey: Survey) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [prefilling, setPrefilling] = useState(true);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [finished, setFinished] = useState(false);
  const [loadingElement, setLoadingElement] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [initiateCountdown, setinitiateCountdown] = useState<boolean>(false);
  const [savedAnswer, setSavedAnswer] = useState<string | null>(null);
  const router = useRouter();
  const URLParams = new URLSearchParams(window.location.search);
  const isPreview = URLParams.get("preview") === "true";
  const hasFirstQuestionPrefill = URLParams.has(survey.questions[0].id);
  const firstQuestionPrefill = hasFirstQuestionPrefill ? URLParams.get(survey.questions[0].id) : null;

  const lastQuestion = currentQuestion?.id === survey.questions[survey.questions.length - 1].id;

  const userId = URLParams.get("userId");
  const { person, isLoadingPerson } = useGetOrCreatePerson(survey.environmentId, isPreview ? null : userId);
  const personId = person?.data.person.id ?? null;

  useEffect(() => {
    if (!isLoadingPerson) {
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
    }
  }, [survey, isPreview, isLoadingPerson]);

  useEffect(() => {
    if (currentQuestion && survey) {
      setProgress(calculateProgress(currentQuestion, survey));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  const calculateProgress = useCallback((currentQuestion, survey) => {
    const elementIdx = survey.questions.findIndex((e) => e.id === currentQuestion.id);
    return elementIdx / survey.questions.length;
  }, []);

  const getNextQuestionId = (): string => {
    const currentQuestionIndex = survey.questions.findIndex((q) => q.id === currentQuestion?.id);
    if (currentQuestionIndex === -1) throw new Error("Question not found");

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
    const activeQuestionId: string = currentQuestion?.id || "";
    const nextQuestionId = getNextQuestionId();
    const answerValue = data[activeQuestionId];

    if (currentQuestion?.logic && currentQuestion?.logic.length > 0) {
      for (let logic of currentQuestion.logic) {
        if (!logic.destination) continue;

        if (evaluateCondition(logic, answerValue)) {
          return logic.destination;
        }
      }
    }

    const finished = nextQuestionId === "end";
    // build response
    const responseRequest: TResponseInput = {
      surveyId: survey.id,
      personId: personId,
      finished,
      data,
    };

    if (!responseId && !isPreview) {
      const response = await createResponse(
        responseRequest,
        `${window.location.protocol}//${window.location.host}`
      );
      if (displayId) {
        markDisplayResponded(
          displayId,
          `${window.location.protocol}//${window.location.host}`,
          survey.environmentId
        );
      }
      setResponseId(response.id);
      storeAnswer(survey.id, response.data);
    } else if (responseId && !isPreview) {
      const updatedResponse = await updateResponse(
        responseRequest,
        responseId,
        `${window.location.protocol}//${window.location.host}`
      );
      storeAnswer(survey.id, updatedResponse.data);
    }

    setLoadingElement(false);

    if (!finished && nextQuestionId !== "end") {
      const question = survey.questions.find((q) => q.id === nextQuestionId);

      if (!question) throw new Error("Question not found");

      setSavedAnswer(getStoredAnswer(survey.id, nextQuestionId));
      setCurrentQuestion(question);
      // setCurrentQuestion(survey.questions[questionIdx + 1]);
    } else {
      setProgress(1);
      setFinished(true);
      clearStoredAnswers(survey.id);
      if (survey.redirectUrl && Object.values(data)[0] !== "dismissed") {
        handleRedirect(survey.redirectUrl);
      }
    }
  };

  const handleRedirect = (url) => {
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      url = `https://${url}`;
    }
    setinitiateCountdown(true);
    setTimeout(() => {
      router.push(url);
    }, 3000);
  };

  const handlePrefilling = useCallback(async () => {
    try {
      if (hasFirstQuestionPrefill) {
        if (!currentQuestion) return;
        const firstQuestionId = survey.questions[0].id;
        if (currentQuestion.id !== firstQuestionId) return;
        const question = survey.questions.find((q) => q.id === firstQuestionId);
        if (!question) throw new Error("Question not found");

        const isValid = checkValidity(question, firstQuestionPrefill);
        if (!isValid) return;

        const answer = createAnswer(question, firstQuestionPrefill || "");
        const answerObj = { [firstQuestionId]: answer };
        await submitResponse(answerObj);
      }
    } finally {
      setPrefilling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, firstQuestionPrefill]);

  useEffect(() => {
    handlePrefilling();
  }, [handlePrefilling]);

  const getPreviousQuestionId = (): string => {
    const currentQuestionIndex = survey.questions.findIndex((q) => q.id === currentQuestion?.id);
    if (currentQuestionIndex === -1) throw new Error("Question not found");

    return survey.questions[currentQuestionIndex - 1].id;
  };

  const goToPreviousQuestion = () => {
    setLoadingElement(true);
    const previousQuestionId = getPreviousQuestionId();
    const previousQuestion = survey.questions.find((q) => q.id === previousQuestionId);

    if (!previousQuestion) throw new Error("Question not found");

    setLoadingElement(false);
    setSavedAnswer(getStoredAnswer(survey.id, previousQuestion.id));
    setCurrentQuestion(previousQuestion);
  };

  const goToNextQuestion = () => {
    console.log("goToNextQuestion");
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId();
    const nextQuestion = survey.questions.find((q) => q.id === nextQuestionId);

    if (!nextQuestion) throw new Error("Question not found");

    setLoadingElement(false);
    setSavedAnswer(getStoredAnswer(survey.id, nextQuestion.id));
    setCurrentQuestion(nextQuestion);
  };

  return {
    currentQuestion,
    progress,
    finished,
    isPreview,
    loadingElement,
    prefilling,
    lastQuestion,
    initiateCountdown,
    submitResponse,
    restartSurvey,
    goToPreviousQuestion,
    goToNextQuestion,
    savedAnswer,
  };
};

const storeAnswer = (surveyId: string, answer: Response["data"]) => {
  const storedAnswers = localStorage.getItem(`formbricks-${surveyId}-answers`);
  if (storedAnswers) {
    const parsedAnswers = JSON.parse(storedAnswers);
    localStorage.setItem(`formbricks-${surveyId}-answers`, JSON.stringify({ ...parsedAnswers, ...answer }));
  } else {
    localStorage.setItem(`formbricks-${surveyId}-answers`, JSON.stringify(answer));
  }
};

const getStoredAnswer = (surveyId: string, questionId: string): string | null => {
  const storedAnswers = localStorage.getItem(`formbricks-${surveyId}-answers`);
  if (storedAnswers) {
    const parsedAnswers = JSON.parse(storedAnswers);
    return parsedAnswers[questionId] || null;
  }
  return null;
};

const clearStoredAnswers = (surveyId: string) => {
  localStorage.removeItem(`formbricks-${surveyId}-answers`);
};

const checkValidity = (question: Question, answer: any): boolean => {
  if (question.required && (!answer || answer === "")) return false;
  try {
    switch (question.type) {
      case QuestionType.OpenText: {
        return true;
      }
      case QuestionType.MultipleChoiceSingle: {
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (!question.choices.find((choice) => choice.label === answer)) return false;
          return true;
        }
        return true;
      }
      case QuestionType.MultipleChoiceMulti: {
        answer = answer.split(",");
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (!answer.every((ans: string) => question.choices.find((choice) => choice.label === ans)))
            return false;
          return true;
        }
        return true;
      }
      case QuestionType.NPS: {
        answer = answer.replace(/&/g, ";");
        const answerNumber = Number(JSON.parse(answer));

        if (isNaN(answerNumber)) return false;
        if (answerNumber < 0 || answerNumber > 10) return false;
        return true;
      }
      case QuestionType.CTA: {
        if (question.required && answer === "dismissed") return false;
        if (answer !== "clicked" && answer !== "dismissed") return false;
        return true;
      }
      case QuestionType.Consent: {
        if (question.required && answer === "dismissed") return false;
        if (answer !== "accepted" && answer !== "dismissed") return false;
        return true;
      }
      case QuestionType.Rating: {
        answer = answer.replace(/&/g, ";");
        const answerNumber = Number(JSON.parse(answer));
        if (answerNumber < 1 || answerNumber > question.range) return false;
        return true;
      }
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
};

const createAnswer = (question: Question, answer: string): string | number | string[] => {
  switch (question.type) {
    case QuestionType.OpenText:
    case QuestionType.MultipleChoiceSingle:
    case QuestionType.Consent:
    case QuestionType.CTA: {
      return answer;
    }

    case QuestionType.Rating:
    case QuestionType.NPS: {
      answer = answer.replace(/&/g, ";");
      return Number(JSON.parse(answer));
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
};

const evaluateCondition = (logic: Logic, answerValue: any): boolean => {
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
    case "accepted":
      return answerValue === "accepted";
    case "clicked":
      return answerValue === "clicked";
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
};
