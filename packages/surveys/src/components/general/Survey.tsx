import { EndingCard } from "@/components/general/EndingCard";
import { FormbricksBranding } from "@/components/general/FormbricksBranding";
import { LanguageSwitch } from "@/components/general/LanguageSwitch";
import { ProgressBar } from "@/components/general/ProgressBar";
import { QuestionConditional } from "@/components/general/QuestionConditional";
import { ResponseErrorComponent } from "@/components/general/ResponseErrorComponent";
import { SurveyCloseButton } from "@/components/general/SurveyCloseButton";
import { WelcomeCard } from "@/components/general/WelcomeCard";
import { AutoCloseWrapper } from "@/components/wrappers/AutoCloseWrapper";
import { StackedCardsContainer } from "@/components/wrappers/StackedCardsContainer";
import { evaluateCondition } from "@/lib/logicEvaluator";
import { parseRecallInformation, replaceRecallInfo } from "@/lib/recall";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { SurveyBaseProps } from "@formbricks/types/formbricks-surveys";
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
  hiddenFieldsRecord,
  clickOutside,
  shouldResetQuestionId,
  fullSizeCards = false,
  autoFocus,
}: SurveyBaseProps) => {
  const autoFocusEnabled = autoFocus !== undefined ? autoFocus : window.self === window.top;

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
  const [selectedLanguage, setselectedLanguage] = useState(languageCode);
  const [loadingElement, setLoadingElement] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [responseData, setResponseData] = useState<TResponseData>(hiddenFieldsRecord ?? {});
  const [ttc, setTtc] = useState<TResponseTtc>({});
  const questionIds = useMemo(() => survey.questions.map((question) => question.id), [survey.questions]);
  const cardArrangement = useMemo(() => {
    if (survey.type === "link") {
      return styling.cardArrangement?.linkSurveys ?? "straight";
    } else {
      return styling.cardArrangement?.appSurveys ?? "straight";
    }
  }, [survey.type, styling.cardArrangement?.linkSurveys, styling.cardArrangement?.appSurveys]);

  const currentQuestionIndex = survey.questions.findIndex((q) => q.id === questionId);
  const currentQuestion = useMemo(() => {
    if (!questionIds.includes(questionId)) {
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
  const getShowLanguageSwitch = (offset: number) => {
    return survey.showLanguageSwitch && survey.languages.length > 0 && offset <= 0;
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

  useEffect(() => {
    setselectedLanguage(languageCode);
  }, [languageCode]);

  let currIdxTemp = currentQuestionIndex;
  let currQuesTemp = currentQuestion;

  const getNextQuestionId = (data: TResponseData): string | undefined => {
    const questions = survey.questions;
    const responseValue = data[questionId];
    const firstEndingId = survey.endings.length > 0 ? survey.endings[0].id : undefined;
    if (questionId === "start") return questions[0]?.id || firstEndingId;
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
              return getLocalizedValue(choice.label, selectedLanguage) === responseValue;
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
                return responseValue.includes(getLocalizedValue(choice.label, selectedLanguage));
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

    return questions[currIdxTemp + 1]?.id || firstEndingId;
  };

  const onChange = (responseDataUpdate: TResponseData) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };

  const onSubmit = (responseData: TResponseData, ttc: TResponseTtc) => {
    const questionId = Object.keys(responseData)[0];
    setLoadingElement(true);
    const nextQuestionId = getNextQuestionId(responseData);
    const finished =
      nextQuestionId === undefined ||
      !survey.questions.map((question) => question.id).includes(nextQuestionId);
    onChange(responseData);
    onResponse({ data: responseData, ttc, finished, language: selectedLanguage });
    if (finished) {
      // Post a message to the parent window indicating that the survey is completed.
      window.parent.postMessage("formbricksSurveyCompleted", "*");
      onFinished();
    }
    if (nextQuestionId) {
      setQuestionId(nextQuestionId);
    }
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
            key="start"
            headline={survey.welcomeCard.headline}
            html={survey.welcomeCard.html}
            fileUrl={survey.welcomeCard.fileUrl}
            buttonLabel={survey.welcomeCard.buttonLabel}
            onSubmit={onSubmit}
            survey={survey}
            languageCode={selectedLanguage}
            responseCount={responseCount}
            autoFocusEnabled={autoFocusEnabled}
            replaceRecallInfo={replaceRecallInfo}
            isCurrent={offset === 0}
            responseData={responseData}
          />
        );
      } else if (questionIdx >= survey.questions.length) {
        const endingCard = survey.endings.find((ending) => {
          return ending.id === questionId;
        });
        if (endingCard) {
          return (
            <EndingCard
              survey={survey}
              endingCard={endingCard}
              isRedirectDisabled={isRedirectDisabled}
              autoFocusEnabled={autoFocusEnabled}
              isCurrent={offset === 0}
              languageCode={selectedLanguage}
              isResponseSendingFinished={isResponseSendingFinished}
              responseData={responseData}
            />
          );
        }
      } else {
        const question = survey.questions[questionIdx];
        return (
          question && (
            <QuestionConditional
              key={question.id}
              surveyId={survey.id}
              question={parseRecallInformation(question, selectedLanguage, responseData, survey.variables)}
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
              languageCode={selectedLanguage}
              autoFocusEnabled={autoFocusEnabled}
              currentQuestionId={questionId}
            />
          )
        );
      }
    };

    return (
      <AutoCloseWrapper survey={survey} onClose={onClose} offset={offset}>
        <div
          className={cn(
            "fb-no-scrollbar md:fb-rounded-custom fb-rounded-t-custom fb-bg-survey-bg fb-flex fb-h-full fb-w-full fb-flex-col fb-justify-between fb-overflow-hidden fb-transition-all fb-duration-1000 fb-ease-in-out",
            cardArrangement === "simple" ? "fb-survey-shadow" : "",
            offset === 0 || cardArrangement === "simple" ? "fb-opacity-100" : "fb-opacity-0"
          )}>
          <div className="fb-flex fb-h-6 fb-justify-end fb-pr-2 fb-pt-2">
            {getShowLanguageSwitch(offset) && (
              <LanguageSwitch
                surveyLanguages={survey.languages}
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
          <div className="fb-mx-6 fb-mb-10 fb-mt-2 fb-space-y-3 md:fb-mb-6 md:fb-mt-6">
            {isBrandingEnabled && <FormbricksBranding />}
            {showProgressBar && <ProgressBar survey={survey} questionId={questionId} />}
          </div>
        </div>
      </AutoCloseWrapper>
    );
  };

  return (
    <>
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
    </>
  );
};
