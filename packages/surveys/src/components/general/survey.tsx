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
import { ApiClient } from "@/lib/api-client";
import { evaluateLogic, performActions } from "@/lib/logic";
import { parseRecallInformation } from "@/lib/recall";
import { ResponseQueue } from "@/lib/response-queue";
import { SurveyState } from "@/lib/survey-state";
import { cn, getDefaultLanguageCode } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type JSX, useCallback } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { type TJsEnvironmentStateSurvey, TJsFileUploadParams } from "@formbricks/types/js";
import type {
  TResponseData,
  TResponseDataValue,
  TResponseTtc,
  TResponseUpdate,
  TResponseVariables,
} from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface VariableStackEntry {
  questionId: TSurveyQuestionId;
  variables: TResponseVariables;
}

export function Survey({
  appUrl,
  environmentId,
  isPreviewMode = false,
  userId,
  contactId,
  mode,
  survey,
  styling,
  isBrandingEnabled,
  onDisplay,
  onResponse,
  onFileUpload,
  onClose,
  onFinished,
  onRetry,
  onDisplayCreated,
  onResponseCreated,
  onOpenExternalURL,
  isRedirectDisabled = false,
  prefillResponseData,
  skipPrefilled,
  languageCode,
  getSetIsError,
  getSetIsResponseSendingFinished,
  getSetQuestionId,
  getSetResponseData,
  responseCount,
  startAtQuestionId,
  hiddenFieldsRecord,
  shouldResetQuestionId,
  fullSizeCards = false,
  autoFocus,
  action,
  singleUseId,
  singleUseResponseId,
  isWebEnvironment = true,
  recaptchaSiteKey,
  getRecaptchaToken,
}: SurveyContainerProps) {
  let apiClient: ApiClient | null = null;

  if (appUrl && environmentId) {
    apiClient = new ApiClient({
      appUrl,
      environmentId,
    });
  }

  const surveyState = useMemo(() => {
    if (appUrl && environmentId) {
      if (mode === "inline") {
        return new SurveyState(survey.id, singleUseId, singleUseResponseId, userId, contactId);
      }

      return new SurveyState(survey.id, null, null, userId, contactId);
    }
    return null;
  }, [appUrl, environmentId, mode, survey.id, userId, singleUseId, singleUseResponseId, contactId]);

  // Update the responseQueue to use the stored responseId
  const responseQueue = useMemo(() => {
    if (appUrl && environmentId && surveyState) {
      return new ResponseQueue(
        {
          appUrl,
          environmentId,
          retryAttempts: 2,
          onResponseSendingFailed: () => {
            setShowError(true);

            if (getSetIsError) {
              getSetIsError((_prev) => {});
            }
          },
          onResponseSendingFinished: () => {
            setIsResponseSendingFinished(true);

            if (getSetIsResponseSendingFinished) {
              getSetIsResponseSendingFinished((_prev) => {});
            }
          },
        },
        surveyState
      );
    }

    return null;
  }, [appUrl, environmentId, getSetIsError, getSetIsResponseSendingFinished, surveyState]);

  const [hasInteracted, setHasInteracted] = useState(false);

  const [localSurvey, setlocalSurvey] = useState<TJsEnvironmentStateSurvey>(survey);
  const [currentVariables, setCurrentVariables] = useState<TResponseVariables>({});

  // Update localSurvey when the survey prop changes (it changes in case of survey editor)
  useEffect(() => {
    setlocalSurvey(survey);
  }, [survey]);

  useEffect(() => {
    setCurrentVariables(
      survey.variables.reduce<TResponseVariables>((acc, variable) => {
        acc[variable.id] = variable.value;
        return acc;
      }, {})
    );
  }, [survey.variables]);

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
  const [isResponseSendingFinished, setIsResponseSendingFinished] = useState(
    !getSetIsResponseSendingFinished
  );
  const [isSurveyFinished, setIsSurveyFinished] = useState(false);
  const [selectedLanguage, setselectedLanguage] = useState(languageCode);
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>(hiddenFieldsRecord ?? {});
  const [_variableStack, setVariableStack] = useState<VariableStackEntry[]>([]);

  const [ttc, setTtc] = useState<TResponseTtc>({});
  const cardArrangement = useMemo(() => {
    if (localSurvey.type === "link") {
      return styling.cardArrangement?.linkSurveys ?? "straight";
    }
    return styling.cardArrangement?.appSurveys ?? "straight";
  }, [localSurvey.type, styling.cardArrangement?.linkSurveys, styling.cardArrangement?.appSurveys]);

  const currentQuestionIndex = localSurvey.questions.findIndex((q) => q.id === questionId);
  const currentQuestion = localSurvey.questions[currentQuestionIndex];

  const contentRef = useRef<HTMLDivElement | null>(null);
  const showProgressBar = !styling.hideProgressBar;
  const getShowSurveyCloseButton = (offset: number) => {
    return offset === 0 && localSurvey.type !== "link";
  };
  const getShowLanguageSwitch = (offset: number) => {
    return localSurvey.showLanguageSwitch && localSurvey.languages.length > 0 && offset <= 0;
  };

  const onFileUploadApi = async (file: TJsFileUploadParams["file"], params?: TUploadFileConfig) => {
    if (isPreviewMode) {
      // return mock url since an url is required for the preview
      return `https://example.com/${file.name}`;
    }

    if (!apiClient) {
      throw new Error("apiClient not initialized");
    }

    const response = await apiClient.uploadFile(
      {
        type: file.type,
        name: file.name,
        base64: file.base64,
      },
      params
    );

    return response;
  };

  useEffect(() => {
    // scroll to top when question changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);

  const createDisplay = useCallback(async () => {
    // Skip display creation in preview mode but still trigger the onDisplayCreated callback
    if (isPreviewMode) {
      if (onDisplayCreated) {
        onDisplayCreated();
      }
      if (onDisplay) {
        onDisplay();
      }
      return;
    }

    if (apiClient && surveyState && responseQueue) {
      try {
        const display = await apiClient.createDisplay({
          surveyId: survey.id,
          ...(userId && { userId }),
          ...(contactId && { contactId }),
        });

        if (!display.ok) {
          // @ts-expect-error -- display.error is of type ApiErrorResponse
          throw new Error(display.error);
        }

        surveyState.updateDisplayId(display.data.id);
        responseQueue.updateSurveyState(surveyState);

        if (onDisplayCreated) {
          onDisplayCreated();
        }
      } catch (err) {
        console.error("error creating display: ", err);
      }
    }
  }, [
    apiClient,
    surveyState,
    responseQueue,
    survey.id,
    userId,
    contactId,
    onDisplayCreated,
    isPreviewMode,
    onDisplay,
  ]);

  useEffect(() => {
    // call onDisplay when component is mounted

    if (appUrl && environmentId) {
      createDisplay();
    } else {
      onDisplay?.();
    }

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

  const onResponseCreateOrUpdate = useCallback(
    async (responseUpdate: TResponseUpdate) => {
      // Always trigger the onResponse callback even in preview mode
      if (!appUrl || !environmentId) {
        onResponse?.({
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
          variables: responseUpdate.variables,
          language: responseUpdate.language,
          endingId: responseUpdate.endingId,
        });
        return;
      }

      // Skip response creation in preview mode but still trigger the onResponseCreated callback
      if (isPreviewMode) {
        if (onResponseCreated) {
          onResponseCreated();
        }

        // When in preview mode, set isResponseSendingFinished to true if the response is finished
        if (responseUpdate.finished) {
          setIsResponseSendingFinished(true);
        }
        return;
      }

      if (surveyState && responseQueue) {
        if (contactId) {
          surveyState.updateContactId(contactId);
        }

        if (userId) {
          surveyState.updateUserId(userId);
        }

        if (recaptchaSiteKey && !surveyState?.responseId && getRecaptchaToken) {
          const token = await getRecaptchaToken();
          responseQueue.setResponseRecaptchaToken(token);

          // // adding sleep of 1 second to receive the recaptcha token
          // await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        responseQueue.updateSurveyState(surveyState);
        responseQueue.add({
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
          language:
            responseUpdate.language === "default" ? getDefaultLanguageCode(survey) : responseUpdate.language,
          meta: {
            ...(isWebEnvironment && { url: window.location.href }),
            action,
          },
          variables: responseUpdate.variables,
          displayId: surveyState.displayId,
          hiddenFields: hiddenFieldsRecord,
        });

        if (onResponseCreated) {
          onResponseCreated();
        }
      }
    },
    [
      appUrl,
      environmentId,
      isPreviewMode,
      surveyState,
      responseQueue,
      onResponse,
      onResponseCreated,
      contactId,
      recaptchaSiteKey,
      getRecaptchaToken,
      userId,
      survey,
      isWebEnvironment,
      action,
      hiddenFieldsRecord,
    ]
  );

  useEffect(() => {
    if (!recaptchaSiteKey) return;

    window.addEventListener("recaptchaToken", (event) => {
      const customEvent = event as CustomEvent;

      const recaptchaToken = customEvent.detail.token;
      if (responseQueue && recaptchaToken) {
        responseQueue.setResponseRecaptchaToken(recaptchaToken);
      }
    });

    return () => {
      // Cleanup the event listener when the component unmounts
      window.removeEventListener("recaptchaToken", () => {
        responseQueue?.setResponseRecaptchaToken(undefined);
      });
    };
  }, [recaptchaSiteKey]);

  useEffect(() => {
    if (isResponseSendingFinished && isSurveyFinished) {
      // Post a message to the parent window indicating that the survey is completed.
      window.parent.postMessage("formbricksSurveyCompleted", "*"); // NOSONAR typescript:S2819 // We can't check the targetOrigin here because we don't know the parent window's origin.
      onFinished?.();
    }
  }, [isResponseSendingFinished, isSurveyFinished, onFinished]);

  const onSubmit = async (surveyResponseData: TResponseData, responsettc: TResponseTtc) => {
    const respondedQuestionId = Object.keys(surveyResponseData)[0];
    setLoadingElement(true);

    pushVariableState(respondedQuestionId);

    const { nextQuestionId, calculatedVariables } = evaluateLogicAndGetNextQuestionId(surveyResponseData);
    const finished =
      nextQuestionId === undefined ||
      !localSurvey.questions.map((question) => question.id).includes(nextQuestionId);

    setIsSurveyFinished(finished);

    const endingId = nextQuestionId
      ? localSurvey.endings.find((ending) => ending.id === nextQuestionId)?.id
      : undefined;

    onChange(surveyResponseData);
    onChangeVariables(calculatedVariables);

    onResponseCreateOrUpdate({
      data: surveyResponseData,
      ttc: responsettc,
      finished,
      variables: calculatedVariables,
      language: selectedLanguage,
      endingId,
    });

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

  const retryResponse = () => {
    if (responseQueue) {
      setShowError(false);
      void responseQueue.processQueue();
    } else {
      onRetry?.();
    }
  };

  const getCardContent = (questionIdx: number, offset: number): JSX.Element | undefined => {
    if (showError) {
      return (
        <ResponseErrorComponent
          responseData={responseData}
          questions={localSurvey.questions}
          onRetry={retryResponse}
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
              onOpenExternalURL={onOpenExternalURL}
              isPreviewMode={isPreviewMode}
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
              onFileUpload={onFileUpload ?? onFileUploadApi}
              isFirstQuestion={question.id === localSurvey.questions[0]?.id}
              skipPrefilled={skipPrefilled}
              prefilledQuestionValue={getQuestionPrefillData(question.id, offset)}
              isLastQuestion={question.id === localSurvey.questions[localSurvey.questions.length - 1].id}
              languageCode={selectedLanguage}
              autoFocusEnabled={autoFocusEnabled}
              currentQuestionId={questionId}
              isBackButtonHidden={localSurvey.isBackButtonHidden}
              onOpenExternalURL={onOpenExternalURL}
            />
          )
        );
      }
    };

    return (
      <AutoCloseWrapper
        survey={localSurvey}
        onClose={onClose}
        questionIdx={questionIdx}
        hasInteracted={hasInteracted}
        setHasInteracted={setHasInteracted}>
        <div
          className={cn(
            "fb-no-scrollbar fb-bg-survey-bg fb-flex fb-h-full fb-w-full fb-flex-col fb-justify-between fb-overflow-hidden fb-transition-all fb-duration-1000 fb-ease-in-out",
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
          <div className="fb-space-y-4">
            {isBrandingEnabled ? <FormbricksBranding /> : null}
            {showProgressBar ? <ProgressBar survey={localSurvey} questionId={questionId} /> : <div></div>}
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
