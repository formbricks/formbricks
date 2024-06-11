import { FormbricksBranding } from "@/components/general/FormbricksBranding";
import { ProgressBar } from "@/components/general/ProgressBar";
import { QuestionConditional } from "@/components/general/QuestionConditional";
import { ResponseErrorComponent } from "@/components/general/ResponseErrorComponent";
import { SurveyCloseButton } from "@/components/general/SurveyCloseButton";
import { ThankYouCard } from "@/components/general/ThankYouCard";
import { WelcomeCard } from "@/components/general/WelcomeCard";
import { AutoCloseWrapper } from "@/components/wrappers/AutoCloseWrapper";
import { StackedCardsContainer } from "@/components/wrappers/StackedCardsContainer";
import { getNextQuestionIdByLogicJump, hasRequirementsSatisfied } from "@/lib/logicEvaluator";
import { parseRecallInformation, replaceRecallInfo } from "@/lib/recall";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { SurveyBaseProps } from "@formbricks/types/formbricksSurveys";
import type { TResponseData, TResponseDataValue, TResponseTtc } from "@formbricks/types/responses";

export const Survey = ({
  survey,
  styling,
  isBrandingEnabled,
  onDisplay = () => {},
  onResponse = () => {},
  onClose = () => {},
  onFinished = () => {},
  onRetry = () => {},
  isRedirectDisabled = false,
  prefillResponseData,
  skipPrefilled,
  languageCode,
  getSetIsError,
  getSetIsResponseSendingFinished,
  getSetQuestionId,
  onFileUpload,
  responseCount,
  startAtQuestionId,
  clickOutside,
  shouldResetQuestionId,
  fullSizeCards = false,
}: SurveyBaseProps) => {
  const isInIframe = window.self !== window.top;

  const [questionId, setQuestionId] = useState(() => {
    if (startAtQuestionId) {
      return startAtQuestionId;
    } else if (survey.welcomeCard.enabled) {
      return "start";
    } else {
      return survey?.questions[0]?.id;
    }
  });
  const [showError, setShowError] = useState(false);
  // flag state to store whether response processing has been completed or not, we ignore this check for survey editor preview and link survey preview where getSetIsResponseSendingFinished is undefined
  const [isResponseSendingFinished, setIsResponseSendingFinished] = useState(
    getSetIsResponseSendingFinished ? false : true
  );

  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>({});
  const [ttc, setTtc] = useState<TResponseTtc>({});
  const cardArrangement = useMemo(() => {
    if (survey.type === "link") {
      return styling.cardArrangement?.linkSurveys ?? "straight";
    } else {
      return styling.cardArrangement?.appSurveys ?? "straight";
    }
  }, [survey.type, styling.cardArrangement?.linkSurveys, styling.cardArrangement?.appSurveys]);

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
  const showProgressBar = !styling.hideProgressBar;
  const getShowSurveyCloseButton = (offset: number) => {
    return offset === 0 && survey.type !== "link" && (clickOutside === undefined ? true : clickOutside);
  };

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  useEffect(() => {
    // call onDisplay when component is mounted
    onDisplay();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (getSetIsError) {
      getSetIsError((value: boolean) => {
        setShowError(value);
      });
    }
  }, [getSetIsError]);

  useEffect(() => {
    if (getSetQuestionId) {
      getSetQuestionId((value: string) => {
        setQuestionId(value);
      });
    }
  }, [getSetQuestionId]);

  useEffect(() => {
    if (getSetIsResponseSendingFinished) {
      getSetIsResponseSendingFinished((value: boolean) => {
        setIsResponseSendingFinished(value);
      });
    }
  }, [getSetIsResponseSendingFinished]);

  const getNextQuestionId = useCallback(
    ({ startQuestionIndex }: { startQuestionIndex?: number }) => {
      // When startQuestionIndex is not set (the first time getNextQuestionId is called), initialize the cursor with currentQuestionIndex
      const cursorQuestionIndex = startQuestionIndex ?? currentQuestionIndex;
      const questions = survey.questions;

      // Jump logic is checked only if the cursor points to the current question
      const checkCurrentQuestionLogicJump = cursorQuestionIndex === currentQuestionIndex && !!currentQuestion;

      let nextQuestionId =
        (checkCurrentQuestionLogicJump &&
          getNextQuestionIdByLogicJump(currentQuestion, responseData, languageCode)) ||
        questions[cursorQuestionIndex + 1]?.id;

      if (nextQuestionId) {
        const nextQuestion = questions.find((q) => q.id === nextQuestionId);
        if (!nextQuestion) throw new Error(`NextQuestion not found for id:${nextQuestionId}`);

        if (hasRequirementsSatisfied(nextQuestion, responseData)) {
          return nextQuestionId;
        }

        return getNextQuestionId({ startQuestionIndex: cursorQuestionIndex + 1 });
      }

      return "end";
    },
    [currentQuestion, currentQuestionIndex, languageCode, responseData, survey.questions]
  );

  let currIdxTemp = currentQuestionIndex;

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };

  const onSubmit = (responseData: TResponseData, ttc: TResponseTtc) => {
    const questionId = Object.keys(responseData)[0];
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId({ startQuestionIndex: currentQuestionIndex });
    const finished = nextQuestionId === "end";
    onChange(responseData);
    onResponse({ data: responseData, ttc, finished });
    if (finished) {
      // Post a message to the parent window indicating that the survey is completed.
      window.parent.postMessage("formbricksSurveyCompleted", "*");
      onFinished();
    }
    setQuestionId(nextQuestionId);
    // add to history
    setHistory([...history, questionId]);
    setLoadingElement(false);
  };

  const onBack = (): void => {
    let prevQuestionId;
    // use history if available
    if (history?.length > 0) {
      const newHistory = [...history];
      prevQuestionId = newHistory.pop();
      setHistory(newHistory);
    } else {
      // otherwise go back to previous question in array
      prevQuestionId = survey.questions[currIdxTemp - 1]?.id;
    }
    if (!prevQuestionId) throw new Error("Question not found");
    setQuestionId(prevQuestionId);
  };

  const getQuestionPrefillData = (questionId: string, offset: number): TResponseDataValue | undefined => {
    if (offset === 0 && prefillResponseData) {
      return prefillResponseData[questionId];
    }
    return undefined;
  };

  const getCardContent = (questionIdx: number, offset: number): JSX.Element | undefined => {
    if (showError) {
      return (
        <ResponseErrorComponent responseData={responseData} questions={survey.questions} onRetry={onRetry} />
      );
    }

    const content = () => {
      if (questionIdx === -1) {
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
            isInIframe={isInIframe}
            replaceRecallInfo={replaceRecallInfo}
          />
        );
      } else if (questionIdx === survey.questions.length) {
        return (
          <ThankYouCard
            headline={replaceRecallInfo(
              getLocalizedValue(survey.thankYouCard.headline, languageCode),
              responseData
            )}
            subheader={replaceRecallInfo(
              getLocalizedValue(survey.thankYouCard.subheader, languageCode),
              responseData
            )}
            isResponseSendingFinished={isResponseSendingFinished}
            buttonLabel={getLocalizedValue(survey.thankYouCard.buttonLabel, languageCode)}
            buttonLink={survey.thankYouCard.buttonLink}
            imageUrl={survey.thankYouCard.imageUrl}
            videoUrl={survey.thankYouCard.videoUrl}
            redirectUrl={survey.redirectUrl}
            isRedirectDisabled={isRedirectDisabled}
            isInIframe={isInIframe}
          />
        );
      } else {
        const question = survey.questions[questionIdx];
        return (
          question && (
            <QuestionConditional
              surveyId={survey.id}
              question={parseRecallInformation(question, languageCode, responseData)}
              value={responseData[question.id]}
              onChange={onChange}
              onSubmit={onSubmit}
              onBack={onBack}
              ttc={ttc}
              setTtc={setTtc}
              onFileUpload={onFileUpload}
              isFirstQuestion={question.id === survey?.questions[0]?.id}
              skipPrefilled={skipPrefilled}
              prefilledQuestionValue={getQuestionPrefillData(question.id, offset)}
              isLastQuestion={question.id === survey.questions[survey.questions.length - 1].id}
              languageCode={languageCode}
              isInIframe={isInIframe}
              currentQuestionId={questionId}
            />
          )
        );
      }
    };

    return (
      <AutoCloseWrapper survey={survey} onClose={onClose} offset={offset}>
        {getShowSurveyCloseButton(offset) && <SurveyCloseButton onClose={onClose} />}
        <div
          className={cn(
            "no-scrollbar md:rounded-custom rounded-t-custom bg-survey-bg flex h-full w-full flex-col justify-between overflow-hidden transition-all duration-1000 ease-in-out",
            cardArrangement === "simple" ? "fb-survey-shadow" : "",
            offset === 0 || cardArrangement === "simple" ? "opacity-100" : "opacity-0"
          )}>
          <div
            ref={contentRef}
            className={cn(loadingElement ? "animate-pulse opacity-60" : "", fullSizeCards ? "" : "my-auto")}>
            {content()}
          </div>
          <div className="mx-6 mb-10 mt-2 space-y-3 md:mb-6 md:mt-6">
            {isBrandingEnabled && <FormbricksBranding />}
            {showProgressBar && <ProgressBar survey={survey} questionId={questionId} />}
          </div>
        </div>
      </AutoCloseWrapper>
    );
  };

  return (
    <StackedCardsContainer
      cardArrangement={cardArrangement}
      currentQuestionId={questionId}
      getCardContent={getCardContent}
      survey={survey}
      styling={styling}
      setQuestionId={setQuestionId}
      shouldResetQuestionId={shouldResetQuestionId}
      fullSizeCards={fullSizeCards}
    />
  );
};
