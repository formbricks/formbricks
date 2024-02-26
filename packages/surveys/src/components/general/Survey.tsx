import FormbricksBranding from "@/components/general/FormbricksBranding";
import ProgressBar from "@/components/general/ProgressBar";
import { ResponseErrorComponent } from "@/components/general/ResponseErrorComponent";
import { AutoCloseWrapper } from "@/components/wrappers/AutoCloseWrapper";
import { evaluateCondition } from "@/lib/logicEvaluator";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { formatDateWithOrdinal, isValidDateString } from "@formbricks/lib/utils/datetime";
import { extractFallbackValue, extractId, extractRecallInfo } from "@formbricks/lib/utils/recall";
import { SurveyBaseProps } from "@formbricks/types/formbricksSurveys";
import type { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import { TSurveyQuestion } from "@formbricks/types/surveys";

import QuestionConditional from "./QuestionConditional";
import ThankYouCard from "./ThankYouCard";
import WelcomeCard from "./WelcomeCard";

export function Survey({
  survey,
  isBrandingEnabled,
  activeQuestionId,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
  onFinished = () => {},
  onRetry = () => {},
  isRedirectDisabled = false,
  prefillResponseData,
  languageCode,
  getSetIsError,
  onFileUpload,
  responseCount,
}: SurveyBaseProps) {
  const [questionId, setQuestionId] = useState(
    activeQuestionId || (survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id)
  );
  const [showError, setShowError] = useState(false);
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>({});
  const [ttc, setTtc] = useState<TResponseTtc>({});

  const currentQuestionIndex = survey.questions.findIndex((q) => q.id === questionId);
  const currentQuestion = useMemo(() => {
    if (questionId === "end" && !survey.thankYouCard.enabled) {
      const newHistory = [...history];
      const prevQuestionId = newHistory.pop();
      return survey.questions.find((q) => q.id === prevQuestionId);
    } else {
      return survey.questions.find((q) => q.id === questionId);
    }
  }, [questionId, survey, history]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const showProgressBar = !survey.styling?.hideProgressBar;

  useEffect(() => {
    if (activeQuestionId === "hidden" || activeQuestionId === "multiLanguage") return;
    if (activeQuestionId === "start" && !survey.welcomeCard.enabled) {
      setQuestionId(survey?.questions[0]?.id);
      return;
    }
    setQuestionId(activeQuestionId || (survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id));
  }, [activeQuestionId, survey.questions, survey.welcomeCard.enabled]);

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  useEffect(() => {
    // call onDisplay when component is mounted
    onDisplay();
    if (prefillResponseData) {
      onSubmit(prefillResponseData, {}, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (getSetIsError) {
      getSetIsError((value: boolean) => {
        setShowError(value);
      });
    }
  });

  let currIdxTemp = currentQuestionIndex;
  let currQuesTemp = currentQuestion;

  function getNextQuestionId(data: TResponseData, isFromPrefilling: Boolean = false): string {
    const questions = survey.questions;
    const responseValue = data[questionId];

    if (questionId === "start") {
      if (!isFromPrefilling) {
        return questions[0]?.id || "end";
      } else {
        currIdxTemp = 0;
        currQuesTemp = questions[0];
      }
    }
    if (currIdxTemp === -1) throw new Error("Question not found");
    if (currQuesTemp?.logic && currQuesTemp?.logic.length > 0 && currentQuestion) {
      for (let logic of currQuesTemp.logic) {
        if (!logic.destination) continue;
        // Check if the current question is of type 'multipleChoiceSingle' or 'multipleChoiceMulti'
        if (
          currentQuestion.type === "multipleChoiceSingle" ||
          currentQuestion.type === "multipleChoiceMulti"
        ) {
          let choice;

          // Check if the response is a string (applies to single choice questions)
          // Sonne -> sun
          if (typeof responseValue === "string") {
            // Find the choice in currentQuestion.choices that matches the responseValue after localization
            choice = currentQuestion.choices.find((choice) => {
              return getLocalizedValue(choice.label, languageCode) === responseValue;
            })?.label;

            // If a matching choice is found, get its default localized value
            if (choice) {
              choice = getLocalizedValue(choice, "default");
            }
          }
          // Check if the response is an array (applies to multiple choices questions)
          // ["Sonne","Mond"]->["sun","moon"]
          else if (Array.isArray(responseValue)) {
            // Filter and map the choices in currentQuestion.choices that are included in responseValue after localization
            choice = currentQuestion.choices
              .filter((choice) => {
                return responseValue.includes(getLocalizedValue(choice.label, languageCode));
              })
              .map((choice) => getLocalizedValue(choice.label, "default"));
          }

          // If a choice is determined (either single or multiple), evaluate the logic condition with that choice
          if (choice) {
            if (evaluateCondition(logic, choice)) {
              return logic.destination;
            }
          }
          // If choice is undefined, it implies an "other" option is selected. Evaluate the logic condition for "Other"
          else {
            if (evaluateCondition(logic, "Other")) {
              return logic.destination;
            }
          }
        }
        if (evaluateCondition(logic, responseValue)) {
          return logic.destination;
        }
      }
    }
    return questions[currIdxTemp + 1]?.id || "end";
  }

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };

  const onSubmit = (responseData: TResponseData, ttc: TResponseTtc, isFromPrefilling: Boolean = false) => {
    const questionId = Object.keys(responseData)[0];
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(responseData, isFromPrefilling);
    const finished = nextQuestionId === "end";
    onResponse({ data: responseData, ttc, finished });
    if (finished) {
      onFinished();
    }
    setQuestionId(nextQuestionId);
    // add to history
    setHistory([...history, questionId]);
    setLoadingElement(false);
    onActiveQuestionChange(nextQuestionId);
  };

  const replaceRecallInfo = (text: string): string => {
    while (text.includes("recall:")) {
      const recallInfo = extractRecallInfo(text);
      if (recallInfo) {
        const questionId = extractId(recallInfo);
        const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
        let value = questionId && responseData[questionId] ? (responseData[questionId] as string) : fallback;

        if (isValidDateString(value)) {
          value = formatDateWithOrdinal(new Date(value));
        }
        if (Array.isArray(value)) {
          value = value.join(", ");
        }
        text = text.replace(recallInfo, value);
      }
    }
    return text;
  };

  const parseRecallInformation = (question: TSurveyQuestion) => {
    const modifiedQuestion = structuredClone(question);
    if (question.headline && question.headline[languageCode]?.includes("recall:")) {
      modifiedQuestion.headline[languageCode] = replaceRecallInfo(
        getLocalizedValue(modifiedQuestion.headline, languageCode)
      );
    }
    if (
      question.subheader &&
      question.subheader[languageCode]?.includes("recall:") &&
      modifiedQuestion.subheader
    ) {
      modifiedQuestion.subheader[languageCode] = replaceRecallInfo(
        getLocalizedValue(modifiedQuestion.subheader, languageCode)
      );
    }
    return modifiedQuestion;
  };

  const onBack = (): void => {
    let prevQuestionId;
    // use history if available
    if (history?.length > 0) {
      const newHistory = [...history];
      prevQuestionId = newHistory.pop();
      if (prefillResponseData && prevQuestionId === survey.questions[0].id) return;
      setHistory(newHistory);
    } else {
      // otherwise go back to previous question in array
      prevQuestionId = survey.questions[currIdxTemp - 1]?.id;
    }
    if (!prevQuestionId) throw new Error("Question not found");
    setQuestionId(prevQuestionId);
    onActiveQuestionChange(prevQuestionId);
  };

  function getCardContent() {
    if (showError) {
      return (
        <ResponseErrorComponent responseData={responseData} questions={survey.questions} onRetry={onRetry} />
      );
    }
    if (questionId === "start" && survey.welcomeCard.enabled) {
      return (
        <WelcomeCard
          headline={survey.welcomeCard.headline}
          html={survey.welcomeCard.html}
          fileUrl={survey.welcomeCard.fileUrl}
          buttonLabel={survey.welcomeCard.buttonLabel}
          onSubmit={onSubmit}
          survey={survey}
          languageCode={languageCode}
          responseCount={responseCount}
        />
      );
    } else if (questionId === "end" && survey.thankYouCard.enabled) {
      return (
        <ThankYouCard
          headline={survey.thankYouCard.headline}
          subheader={survey.thankYouCard.subheader}
          buttonLabel={survey.thankYouCard.buttonLabel}
          buttonLink={survey.thankYouCard.buttonLink}
          imageUrl={survey.thankYouCard.imageUrl}
          redirectUrl={survey.redirectUrl}
          isRedirectDisabled={isRedirectDisabled}
          languageCode={languageCode}
          replaceRecallInfo={replaceRecallInfo}
        />
      );
    } else {
      return (
        currentQuestion && (
          <QuestionConditional
            surveyId={survey.id}
            question={parseRecallInformation(currentQuestion)}
            value={responseData[currentQuestion.id]}
            onChange={onChange}
            onSubmit={onSubmit}
            onBack={onBack}
            ttc={ttc}
            setTtc={setTtc}
            onFileUpload={onFileUpload}
            isFirstQuestion={
              history && prefillResponseData
                ? history[history.length - 1] === survey.questions[0].id
                : currentQuestion.id === survey?.questions[0]?.id
            }
            isLastQuestion={currentQuestion.id === survey.questions[survey.questions.length - 1].id}
            languageCode={languageCode}
          />
        )
      );
    }
  }

  return (
    <>
      <AutoCloseWrapper survey={survey} onClose={onClose}>
        <div className="no-scrollbar flex h-full w-full flex-col justify-between rounded-lg bg-[--fb-survey-background-color] px-6 pb-3 pt-6">
          <div ref={contentRef} className={cn(loadingElement ? "animate-pulse opacity-60" : "", "my-auto")}>
            {survey.questions.length === 0 && !survey.welcomeCard.enabled && !survey.thankYouCard.enabled ? (
              // Handle the case when there are no questions and both welcome and thank you cards are disabled
              <div>No questions available.</div>
            ) : (
              getCardContent()
            )}
          </div>
          <div className="mt-8">
            {isBrandingEnabled && <FormbricksBranding />}
            {showProgressBar && <ProgressBar survey={survey} questionId={questionId} />}
          </div>
        </div>
      </AutoCloseWrapper>
    </>
  );
}
