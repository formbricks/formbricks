import { createDisplay, markDisplayResponded } from "@formbricks/lib/client/display";
import { createResponse, updateResponse } from "@formbricks/lib/client/response";
import { fetcher } from "@formbricks/lib/fetcher";
import { Response } from "@formbricks/types/js";
import { Question, QuestionType } from "@formbricks/types/questions";
import { TResponseInput } from "@formbricks/types/v1/responses";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useGetOrCreatePerson } from "../people/people";
import { TSurvey, TSurveyLogic, TSurveyQuestion } from "@formbricks/types/v1/surveys";

interface StoredResponse {
  id: string | null;
  data: { [x: string]: any };
  history: string[];
  singleUseId: string | null;
}

export const useLinkSurvey = (surveyId: string) => {
  const { data, error, mutate, isLoading } = useSWR(`/api/v1/client/surveys/${surveyId}`, fetcher);

  return {
    survey: data,
    isLoadingSurvey: isLoading,
    isErrorSurvey: error,
    mutateSurvey: mutate,
  };
};

export const useLinkSurveyUtils = (survey: TSurvey, singleUseId?: string) => {
  const [currentQuestion, setCurrentQuestion] = useState<TSurveyQuestion | Question | null>(null);
  const [prefilling, setPrefilling] = useState(true);
  const [progress, setProgress] = useState(0); // [0, 1]
  const [finished, setFinished] = useState(false);
  const [loadingElement, setLoadingElement] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [initiateCountdown, setinitiateCountdown] = useState<boolean>(false);
  const [storedResponseValue, setStoredResponseValue] = useState<string | null>(null);
  const router = useRouter();
  const URLParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const isPreview = URLParams.get("preview") === "true";
  const hasFirstQuestionPrefill = URLParams.has(survey.questions[0].id);
  const firstQuestionPrefill = hasFirstQuestionPrefill ? URLParams.get(survey.questions[0].id) : null;

  const lastQuestion = currentQuestion?.id === survey.questions[survey.questions.length - 1].id;

  const userId = URLParams?.get("userId");
  const { person, isLoadingPerson } = useGetOrCreatePerson(survey.environmentId, isPreview ? null : userId);
  const personId = person?.data.person.id ?? null;
  const isSingleUse = survey.singleUse?.enabled ?? false;

  useEffect(() => {
    const storedResponse = getStoredResponse(survey.id, isSingleUse ? singleUseId : null);
    const questionKeys = survey.questions.map((question) => question.id);
    if (storedResponse) {
      // Checks if the stored response is for the same single use id
      if (isSingleUse && storedResponse.singleUseId !== singleUseId) {
        // If not, clear the stored response
        setStoredResponseValue(null);
        setResponseId(null);
        setHistory([]);
        // isSingleUse is used to prevent saving the response in local storage
        // when single use is diabled, even if users manually add the suId query parameter
        clearStoredResponses(survey.id, isSingleUse ? singleUseId : null);
        return;
      }
      if (storedResponse.id) {
        setResponseId(storedResponse.id);
      }
      if (storedResponse.history) {
        setHistory(storedResponse.history);
      }
      const storedResponsesKeys = Object.keys(storedResponse.data);
      // reduce to find the last answered question index
      const lastStoredQuestionIndex = questionKeys.reduce((acc, key, index) => {
        if (storedResponsesKeys.includes(key)) {
          return index;
        }
        return acc;
      }, 0);
      if (survey.questions.length > lastStoredQuestionIndex) {
        const nextQuestion = survey.questions[lastStoredQuestionIndex];
        setCurrentQuestion(nextQuestion);
        setProgress(calculateProgress(nextQuestion, survey));
        setStoredResponseValue(
          getStoredResponseValue(survey.id, nextQuestion.id, isSingleUse ? singleUseId : null)
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoadingPerson) {
      const storedResponse = getStoredResponse(survey.id, isSingleUse ? singleUseId : null);
      if (survey && !storedResponse && !finished) {
        setCurrentQuestion(survey.questions[0]);

        if (isPreview) return;

        // create display
        createDisplay({ surveyId: survey.id }, `${window.location.protocol}//${window.location.host}`).then(
          (display) => {
            setDisplayId(display.id);
          }
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // build response
    const responseRequest: TResponseInput = {
      surveyId: survey.id,
      personId: personId,
      singleUseId: singleUseId ?? null,
      finished,
      data,
      meta: {
        url: window.location.href,
      },
    };

    const nextQuestionId = getNextQuestionId(data);
    responseRequest.finished = nextQuestionId === "end";

    if (!responseId && !isPreview) {
      const response = await createResponse(
        responseRequest,
        `${window.location.protocol}//${window.location.host}`
      );
      if (displayId) {
        markDisplayResponded(displayId, `${window.location.protocol}//${window.location.host}`);
      }
      setResponseId(response.id);
      storeResponse(survey.id, response.data, response.id, history, isSingleUse ? singleUseId : null);
    } else if (responseId && !isPreview) {
      await updateResponse(
        responseRequest,
        responseId,
        `${window.location.protocol}//${window.location.host}`
      );
      storeResponse(survey.id, data, responseId, history, isSingleUse ? singleUseId : null);
    }

    setLoadingElement(false);

    goToNextQuestion(data);
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
    const newHistory = [...history];
    const prevQuestionId = newHistory.pop();
    if (!prevQuestionId) throw new Error("Question not found");
    setHistory(newHistory);
    return prevQuestionId;
  };

  const goToPreviousQuestion = (answer: Response["data"]) => {
    setLoadingElement(true);
    const previousQuestionId = getPreviousQuestionId();
    const previousQuestion = survey.questions.find((q) => q.id === previousQuestionId);

    if (!previousQuestion) throw new Error("Question not found");

    if (answer) {
      storeResponse(survey.id, answer, null, [], isSingleUse ? singleUseId : null);
    }

    setStoredResponseValue(
      getStoredResponseValue(survey.id, previousQuestion.id, isSingleUse ? singleUseId : null)
    );
    setCurrentQuestion(previousQuestion);
    setLoadingElement(false);
  };

  const goToNextQuestion = (answer: Response["data"]) => {
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(answer);

    if (nextQuestionId === "end") {
      setLoadingElement(false);
      setProgress(1);
      setFinished(true);
      clearStoredResponses(survey.id, isSingleUse ? singleUseId : null);
      if (survey.redirectUrl && Object.values(answer)[0] !== "dismissed") {
        handleRedirect(survey.redirectUrl);
      }
      return;
    }

    const newHistory = [...history];
    if (currentQuestion) {
      newHistory.push(currentQuestion.id);
    }
    setHistory(newHistory);

    storeResponse(survey.id, answer, null, newHistory, isSingleUse ? singleUseId : null);

    const nextQuestion = survey.questions.find((q) => q.id === nextQuestionId);

    if (!nextQuestion) throw new Error("Question not found");

    setStoredResponseValue(
      getStoredResponseValue(survey.id, nextQuestion.id, isSingleUse ? singleUseId : null)
    );
    setCurrentQuestion(nextQuestion);
    setLoadingElement(false);
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
    storedResponseValue,
  };
};

const storeResponse = (
  surveyId: string,
  responseData: Response["data"],
  responseId: string | null = null,
  history: string[] = [],
  singleUseId: string | null = null
) => {
  const localStorageKey = `formbricks-${surveyId}-response${singleUseId ? `-${singleUseId}` : ""}`;
  const storedResponses = localStorage.getItem(localStorageKey);
  if (storedResponses) {
    const existingResponse = JSON.parse(storedResponses);
    if (responseId) {
      existingResponse.id = responseId;
    }
    existingResponse.data = { ...existingResponse.data, ...responseData };
    existingResponse.history = history;
    localStorage.setItem(localStorageKey, JSON.stringify(existingResponse));
  } else {
    const response = {
      id: responseId,
      data: responseData,
      history,
      singleUseId,
    };
    localStorage.setItem(localStorageKey, JSON.stringify(response));
  }
};

const getStoredResponse = (surveyId: string, singleUseId: string | null = null): StoredResponse | null => {
  const localStorageKey = `formbricks-${surveyId}-response${singleUseId ? `-${singleUseId}` : ""}`;
  const storedResponses = localStorage.getItem(localStorageKey);
  if (storedResponses) {
    return JSON.parse(storedResponses);
  }
  return null;
};

const getStoredResponseValue = (
  surveyId: string,
  questionId: string,
  singleUseId: string | null = null
): string | null => {
  const storedResponse = getStoredResponse(surveyId, singleUseId);

  if (storedResponse && typeof storedResponse.data === "object") {
    return storedResponse.data[questionId];
  }
  return null;
};

const clearStoredResponses = (surveyId: string, singleUseId: string | null = null) => {
  const localStorageKey = `formbricks-${surveyId}-response${singleUseId ? `-${singleUseId}` : ""}`;
  localStorage.removeItem(localStorageKey);
};

const checkValidity = (question: TSurveyQuestion | Question, answer: any): boolean => {
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

const createAnswer = (question: TSurveyQuestion | Question, answer: string): string | number | string[] => {
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

const evaluateCondition = (logic: TSurveyLogic, responseValue: any): boolean => {
  switch (logic.condition) {
    case "equals":
      return (
        (Array.isArray(responseValue) && responseValue.length === 1 && responseValue.includes(logic.value)) ||
        responseValue.toString() === logic.value
      );
    case "notEquals":
      return responseValue !== logic.value;
    case "lessThan":
      return logic.value !== undefined && responseValue < logic.value;
    case "lessEqual":
      return logic.value !== undefined && responseValue <= logic.value;
    case "greaterThan":
      return logic.value !== undefined && responseValue > logic.value;
    case "greaterEqual":
      return logic.value !== undefined && responseValue >= logic.value;
    case "includesAll":
      return (
        Array.isArray(responseValue) &&
        Array.isArray(logic.value) &&
        logic.value.every((v) => responseValue.includes(v))
      );
    case "includesOne":
      return (
        Array.isArray(responseValue) &&
        Array.isArray(logic.value) &&
        logic.value.some((v) => responseValue.includes(v))
      );
    case "accepted":
      return responseValue === "accepted";
    case "clicked":
      return responseValue === "clicked";
    case "submitted":
      if (typeof responseValue === "string") {
        return responseValue !== "dismissed" && responseValue !== "" && responseValue !== null;
      } else if (Array.isArray(responseValue)) {
        return responseValue.length > 0;
      } else if (typeof responseValue === "number") {
        return responseValue !== null;
      }
      return false;
    case "skipped":
      return (
        (Array.isArray(responseValue) && responseValue.length === 0) ||
        responseValue === "" ||
        responseValue === null ||
        responseValue === "dismissed"
      );
    default:
      return false;
  }
};
