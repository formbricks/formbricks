import { useState } from "react";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyCTAQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { HtmlBody } from "../general/html-body";
import { QuestionMedia } from "../general/question-media";
import { ScrollableContainer } from "../wrappers/scrollable-container";

interface CTAQuestionProps {
  question: TSurveyCTAQuestion;
  survey: TJsEnvironmentStateSurvey;
  value: string;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
}

export function CTAQuestion({
  question,
  survey,
  onSubmit,
  onChange,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId,
  isBackButtonHidden,
  onOpenExternalURL,
}: CTAQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  return (
    <div key={question.id}>
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            headlineColor={survey.styling?.questionColor?.light}
            questionId={question.id}
            required={question.required}
          />
          <HtmlBody htmlString={getLocalizedValue(question.html, languageCode)} questionId={question.id} />
        </div>
      </ScrollableContainer>
      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        {!isFirstQuestion && !isBackButtonHidden ? (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onSubmit({ [question.id]: "" }, updatedTtcObj);
              onBack();
            }}
          />
        ) : (
          <div />
        )}
        <div />
        <div className="flex w-full flex-row-reverse justify-start">
          {!question.required && (
            <button
              dir="auto"
              type="button"
              tabIndex={isCurrent ? 0 : -1}
              onClick={() => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onSubmit({ [question.id]: "" }, updatedTtcObj);
                onChange({ [question.id]: "" });
              }}
              className="text-heading focus:ring-focus mr-4 flex items-center rounded-md px-3 py-3 text-base font-medium leading-4 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2">
              {getLocalizedValue(question.dismissButtonLabel, languageCode) || "Skip"}
            </button>
          )}
          <SubmitButton
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
            focus={isCurrent ? autoFocusEnabled : false}
            tabIndex={isCurrent ? 0 : -1}
            onClick={() => {
              if (question.buttonExternal && question.buttonUrl) {
                if (onOpenExternalURL) {
                  onOpenExternalURL(question.buttonUrl);
                } else {
                  window.open(question.buttonUrl, "_blank")?.focus();
                }
              }
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onSubmit({ [question.id]: "clicked" }, updatedTtcObj);
              onChange({ [question.id]: "clicked" });
            }}
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
