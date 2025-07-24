import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { CalEmbed } from "@/components/general/cal-embed";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useCallback, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import { type TSurveyCalQuestion, type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface CalQuestionProps {
  question: TSurveyCalQuestion;
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
}

export function CalQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  isBackButtonHidden,
}: Readonly<CalQuestionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const [errorMessage, setErrorMessage] = useState("");
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const isCurrent = question.id === currentQuestionId;
  const onSuccessfulBooking = useCallback(() => {
    onChange({ [question.id]: "booked" });
    const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedttc);
    onSubmit({ [question.id]: "booked" }, updatedttc);
  }, [onChange, onSubmit, question.id, setTtc, startTime, ttc]);

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        if (question.required && !value) {
          setErrorMessage("Please book an appointment");
          return;
        }

        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);

        onChange({ [question.id]: value });
        onSubmit({ [question.id]: value }, updatedttc);
      }}
      className="fb-w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
          {errorMessage ? <span className="fb-text-red-500">{errorMessage}</span> : null}
          <CalEmbed key={question.id} question={question} onSuccessfulBooking={onSuccessfulBooking} />
        </div>
      </ScrollableContainer>
      <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {!question.required && (
          <SubmitButton
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
            tabIndex={isCurrent ? 0 : -1}
          />
        )}
        <div />
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              onBack();
            }}
            tabIndex={isCurrent ? 0 : -1}
          />
        )}
      </div>
    </form>
  );
}
