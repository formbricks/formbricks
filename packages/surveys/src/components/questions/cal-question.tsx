import { useCallback, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { CalEmbed } from "@/components/general/cal-embed";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface CalQuestionProps {
  question: TSurveyCalElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentQuestionId: string;
}

export function CalQuestion({
  question,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
}: Readonly<CalQuestionProps>) {
  const { t } = useTranslation();
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const [errorMessage, setErrorMessage] = useState("");
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const onSuccessfulBooking = useCallback(() => {
    setErrorMessage("");
    onChange({ [question.id]: "booked" });
    const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedttc);
  }, [onChange, question.id, setTtc, startTime, ttc, setErrorMessage]);

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        if (question.required && !value) {
          setErrorMessage(t("errors.please_book_an_appointment"));
          return;
        }

        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);

        onChange({ [question.id]: value });
      }}
      className="fb-w-full">
      <div>
        {isMediaAvailable ? <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} /> : null}
        <Headline
          headline={getLocalizedValue(question.headline, languageCode)}
          questionId={question.id}
          required={question.required}
        />
        <Subheader
          subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
          questionId={question.id}
        />
        <CalEmbed key={question.id} question={question} onSuccessfulBooking={onSuccessfulBooking} />
        {errorMessage ? <span className="fb-text-red-500">{errorMessage}</span> : null}
      </div>
    </form>
  );
}
