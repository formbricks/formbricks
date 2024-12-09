import { EndingCard } from "@/components/general/ending-card";
import { FormbricksBranding } from "@/components/general/formbricks-branding";
import { LanguageSwitch } from "@/components/general/language-switch";
import { ProgressBar } from "@/components/general/progress-bar";
import { QuestionConditional } from "@/components/general/question-conditional";
import { ResponseErrorComponent } from "@/components/general/response-error-component";
import { SurveyCloseButton } from "@/components/general/survey-close-button";
import { WelcomeCard } from "@/components/general/welcome-card";
import { AutoCloseWrapper } from "@/components/wrappers/auto-close-wrapper";
import { StackedCardsContainer } from "@/components/wrappers/stacked-cards-container";
import { parseRecallInformation } from "@/lib/recall";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "react";
import { evaluateLogic, performActions } from "@formbricks/lib/surveyLogic/utils";
import { type SurveyBaseProps } from "@formbricks/types/formbricks-surveys";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import type {
  TResponseData,
  TResponseDataValue,
  TResponseTtc,
  TResponseVariables,
} from "@formbricks/types/responses";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface VariableStackEntry {
  questionId: TSurveyQuestionId;
  variables: TResponseVariables;
}

export function Survey({
  survey,
  styling,
  isBrandingEnabled,
  onDisplay,
  onResponse,
  onClose,
  onFinished,
  onRetry,
  isRedirectDisabled = false,
  prefillResponseData,
  skipPrefilled,
  languageCode,
  getSetIsError,
  getSetIsResponseSendingFinished,
  getSetQuestionId,
  getSetResponseData,
  onFileUpload,
  responseCount,
  startAtQuestionId,
  hiddenFieldsRecord,
  clickOutside,
  shouldResetQuestionId,
  fullSizeCards = false,
  autoFocus,
}: SurveyBaseProps) {
  const [localSurvey, setlocalSurvey] = useState<TJsEnvironmentStateSurvey>(survey);

  // Update localSurvey when the survey prop changes (it changes in case of survey editor)
  useEffect(() => {
    setlocalSurvey(survey);
  }, [survey]);

  const autoFocusEnabled = autoFocus ?? window.self === window.top;

  const [questionId, setQuestionId] = useState(() => {
    if (startAtQuestionId) {
      return startAtQuestionId;
    } else if (localSurvey.welcomeCard.enabled) {
      return "start";
    }
    return localSurvey.questions[0]?.id;
  });
  const [showError, setShowError] = useState(false);
  // flag state to store whether response processing has been completed or not, we ignore this check for survey editor preview and link survey preview where getSetIsResponseSendingFinished is undefined
  const [isResponseSendingFinished, setIsResponseSendingFinished] = useState(
    !getSetIsResponseSendingFinished
  );
  const [selectedLanguage, setselectedLanguage] = useState(languageCode);
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>(hiddenFieldsRecord ?? {});
  const [_variableStack, setVariableStack] = useState<VariableStackEntry[]>([]);
  const [currentVariables, setCurrentVariables] = useState<TResponseVariables>(() => {
    return localSurvey.variables.reduce<TResponseVariables>((acc, variable) => {
      acc[variable.id] = variable.value;
      return acc;
    }, {});
  });

  const [ttc, setTtc] = useState<TResponseTtc>({});
  const questionIds = useMemo(
    () => localSurvey.questions.map((question) => question.id),
    [localSurvey.questions]
  );
  const cardArrangement = useMemo(() => {
    if (localSurvey.type === "link") {
      return styling.cardArrangement?.linkSurveys ?? "straight";
    }
    return styling.cardArrangement?.appSurveys ?? "straight";
  }, [localSurvey.type, styling.cardArrangement?.linkSurveys, styling.cardArrangement?.appSurveys]);

  const currentQuestionIndex = localSurvey.questions.findIndex((q) => q.id === questionId);
  const currentQuestion = useMemo(() => {
    if (!questionIds.includes(questionId)) {
      const newHistory = [...history];
      const prevQuestionId = newHistory.pop();
      return localSurvey.questions.find((q) => q.id === prevQuestionId);
    }
    return localSurvey.questions.find((q) => q.id === questionId);
  }, [questionId, localSurvey, history]);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const showProgressBar = !styling.hideProgressBar;
  const getShowSurveyCloseButton = (offset: number) => {
    return offset === 0 && localSurvey.type !== "link" && (clickOutside ?? true);
  };
  const getShowLanguageSwitch = (offset: number) => {
    return localSurvey.showLanguageSwitch && localSurvey.languages.length > 0 && offset <= 0;
  };

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  useEffect(() => {
    // call onDisplay when component is mounted
    onDisplay?.();

    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDisplay should only be called once
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
    if (getSetResponseData) {
      getSetResponseData((value: TResponseData) => {
        setResponseData(value);
      });
    }
  }, [getSetResponseData]);

  useEffect(() => {
    if (getSetIsResponseSendingFinished) {
      getSetIsResponseSendingFinished((value: boolean) => {
        setIsResponseSendingFinished(value);
      });
    }
  }, [getSetIsResponseSendingFinished]);

  useEffect(() => {
    setselectedLanguage(languageCode);
  }, [languageCode]);

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };

  const onChangeVariables = (variables: TResponseVariables) => {
    const updatedVariables = { ...currentVariables, ...variables };
    setCurrentVariables(updatedVariables);
  };

  const makeQuestionsRequired = (requiredQuestionIds: string[]): void => {
    setlocalSurvey((prevSurvey) => ({
      ...prevSurvey,
      questions: prevSurvey.questions.map((question) => {
        if (requiredQuestionIds.includes(question.id)) {
          return {
            ...question,
            required: true,
          };
        }
        return question;
      }),
    }));
  };

  const pushVariableState = (currentQuestionId: TSurveyQuestionId) => {
    setVariableStack((prevStack) => [
      ...prevStack,
      { questionId: currentQuestionId, variables: { ...currentVariables } },
    ]);
  };

  const popVariableState = () => {
    setVariableStack((prevStack) => {
      const newStack = [...prevStack];
      const poppedState = newStack.pop();
      if (poppedState) {
        setCurrentVariables(poppedState.variables);
      }
      return newStack;
    });
  };

  const evaluateLogicAndGetNextQuestionId = (
    data: TResponseData
  ): { nextQuestionId: TSurveyQuestionId | undefined; calculatedVariables: TResponseVariables } => {
    const questions = survey.questions;
    const firstEndingId = survey.endings.length > 0 ? survey.endings[0].id : undefined;

    if (questionId === "start")
      return { nextQuestionId: questions[0]?.id || firstEndingId, calculatedVariables: {} };

    if (!currentQuestion) throw new Error("Question not found");

    let firstJumpTarget: string | undefined;
    const allRequiredQuestionIds: string[] = [];

    let calculationResults = { ...currentVariables };
    const localResponseData = { ...responseData, ...data };

    if (currentQuestion.logic && currentQuestion.logic.length > 0) {
      for (const logic of currentQuestion.logic) {
        if (
          evaluateLogic(
            localSurvey,
            localResponseData,
            calculationResults,
            logic.conditions,
            selectedLanguage
          )
        ) {
          const { jumpTarget, requiredQuestionIds, calculations } = performActions(
            localSurvey,
            logic.actions,
            localResponseData,
            calculationResults
          );

          if (jumpTarget && !firstJumpTarget) {
            firstJumpTarget = jumpTarget;
          }

          allRequiredQuestionIds.push(...requiredQuestionIds);
          calculationResults = { ...calculationResults, ...calculations };
        }
      }
    }

    // Use logicFallback if no jump target was set
    if (!firstJumpTarget && currentQuestion.logicFallback) {
      firstJumpTarget = currentQuestion.logicFallback;
    }

    // Make all collected questions required
    if (allRequiredQuestionIds.length > 0) {
      makeQuestionsRequired(allRequiredQuestionIds);
    }

    // Return the first jump target if found, otherwise go to the next question or ending
    const nextQuestionId = firstJumpTarget ?? questions[currentQuestionIndex + 1]?.id ?? firstEndingId;

    return { nextQuestionId, calculatedVariables: calculationResults };
  };

  const onSubmit = (surveyResponseData: TResponseData, responsettc: TResponseTtc) => {
    const respondedQuestionId = Object.keys(surveyResponseData)[0];
    setLoadingElement(true);

    pushVariableState(respondedQuestionId);

    const { nextQuestionId, calculatedVariables } = evaluateLogicAndGetNextQuestionId(surveyResponseData);
    const finished =
      nextQuestionId === undefined ||
      !localSurvey.questions.map((question) => question.id).includes(nextQuestionId);

    const endingId = nextQuestionId
      ? localSurvey.endings.find((ending) => ending.id === nextQuestionId)?.id
      : undefined;

    onChange(surveyResponseData);
    onChangeVariables(calculatedVariables);
    onResponse?.({
      data: surveyResponseData,
      ttc: responsettc,
      finished,
      variables: calculatedVariables,
      language: selectedLanguage,
      endingId,
    });
    if (finished) {
      // Post a message to the parent window indicating that the survey is completed.
      window.parent.postMessage("formbricksSurveyCompleted", "*");
      onFinished?.();
    }
    if (nextQuestionId) {
      setQuestionId(nextQuestionId);
    }
    // add to history
    setHistory([...history, respondedQuestionId]);
    setLoadingElement(false);
  };

  const onBack = (): void => {
    let prevQuestionId;
    // use history if available
    if (history.length > 0) {
      const newHistory = [...history];
      prevQuestionId = newHistory.pop();
      setHistory(newHistory);
    } else {
      // otherwise go back to previous question in array
      prevQuestionId = localSurvey.questions[currentQuestionIndex - 1]?.id;
    }
    popVariableState();
    if (!prevQuestionId) throw new Error("Question not found");
    setQuestionId(prevQuestionId);
  };

  const getQuestionPrefillData = (
    prefillQuestionId: TSurveyQuestionId,
    offset: number
  ): TResponseDataValue | undefined => {
    if (offset === 0 && prefillResponseData) {
      return prefillResponseData[prefillQuestionId];
    }
    return undefined;
  };

  const getCardContent = (questionIdx: number, offset: number): JSX.Element | undefined => {
    if (showError) {
      return (
        <ResponseErrorComponent
          responseData={responseData}
          questions={localSurvey.questions}
          onRetry={onRetry}
        />
      );
    }

    const content = () => {
      if (questionIdx === -1) {
        return (
          <WelcomeCard
            key="start"
            headline={localSurvey.welcomeCard.headline}
            html={localSurvey.welcomeCard.html}
            fileUrl={localSurvey.welcomeCard.fileUrl}
            buttonLabel={localSurvey.welcomeCard.buttonLabel}
            onSubmit={onSubmit}
            survey={localSurvey}
            languageCode={selectedLanguage}
            responseCount={responseCount}
            autoFocusEnabled={autoFocusEnabled}
            isCurrent={offset === 0}
            responseData={responseData}
            variablesData={currentVariables}
          />
        );
      } else if (questionIdx >= localSurvey.questions.length) {
        const endingCard = localSurvey.endings.find((ending) => {
          return ending.id === questionId;
        });
        if (endingCard) {
          return (
            <EndingCard
              survey={localSurvey}
              endingCard={endingCard}
              isRedirectDisabled={isRedirectDisabled}
              autoFocusEnabled={autoFocusEnabled}
              isCurrent={offset === 0}
              languageCode={selectedLanguage}
              isResponseSendingFinished={isResponseSendingFinished}
              responseData={responseData}
              variablesData={currentVariables}
            />
          );
        }
      } else {
        const question = localSurvey.questions[questionIdx];
        return (
          Boolean(question) && (
            <QuestionConditional
              key={question.id}
              surveyId={localSurvey.id}
              question={parseRecallInformation(question, selectedLanguage, responseData, currentVariables)}
              value={responseData[question.id]}
              onChange={onChange}
              onSubmit={onSubmit}
              onBack={onBack}
              ttc={ttc}
              setTtc={setTtc}
              onFileUpload={onFileUpload}
              isFirstQuestion={question.id === localSurvey.questions[0]?.id}
              skipPrefilled={skipPrefilled}
              prefilledQuestionValue={getQuestionPrefillData(question.id, offset)}
              isLastQuestion={question.id === localSurvey.questions[localSurvey.questions.length - 1].id}
              languageCode={selectedLanguage}
              autoFocusEnabled={autoFocusEnabled}
              currentQuestionId={questionId}
            />
          )
        );
      }
    };

    return (
      <AutoCloseWrapper survey={localSurvey} onClose={onClose} offset={offset}>
        <div
          className={cn(
            "fb-no-scrollbar sm:fb-rounded-custom fb-rounded-t-custom fb-bg-survey-bg fb-flex fb-h-full fb-w-full fb-flex-col fb-justify-between fb-overflow-hidden fb-transition-all fb-duration-1000 fb-ease-in-out",
            cardArrangement === "simple" ? "fb-survey-shadow" : "",
            offset === 0 || cardArrangement === "simple" ? "fb-opacity-100" : "fb-opacity-0"
          )}>
          <div className="fb-flex fb-h-6 fb-justify-end fb-pr-2 fb-pt-2">
            {getShowLanguageSwitch(offset) && (
              <LanguageSwitch
                surveyLanguages={localSurvey.languages}
                setSelectedLanguageCode={setselectedLanguage}
              />
            )}
            {getShowSurveyCloseButton(offset) && <SurveyCloseButton onClose={onClose} />}
          </div>
          <div
            ref={contentRef}
            className={cn(
              loadingElement ? "fb-animate-pulse fb-opacity-60" : "",
              fullSizeCards ? "" : "fb-my-auto"
            )}>
            {content()}
          </div>
          <div className="fb-mx-6 fb-mb-10 fb-mt-2 fb-space-y-3 sm:fb-mb-6 sm:fb-mt-6">
            {isBrandingEnabled ? <FormbricksBranding /> : null}
            {showProgressBar ? <ProgressBar survey={localSurvey} questionId={questionId} /> : null}
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
      survey={localSurvey}
      styling={styling}
      setQuestionId={setQuestionId}
      shouldResetQuestionId={shouldResetQuestionId}
      fullSizeCards={fullSizeCards}
    />
  );
}
