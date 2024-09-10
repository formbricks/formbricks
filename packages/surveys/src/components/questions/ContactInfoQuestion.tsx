import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { Input } from "@/components/general/Input";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyContactInfoQuestion } from "@formbricks/types/surveys/types";

interface ContactInfoQuestionProps {
  question: TSurveyContactInfoQuestion;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: string;
}

export const ContactInfoQuestion = ({
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
  autoFocusEnabled,
  currentQuestionId,
}: ContactInfoQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  // const [, setHasFilled] = useState(false);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const formRef = useRef<HTMLFormElement>(null);
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const fields = [
    {
      id: "firstName",
      placeholder: "First Name",
      ...question.firstName,
    },
    {
      id: "lastName",
      placeholder: "Last Name",
      ...question.lastName,
    },
    {
      id: "email",
      placeholder: "Email",
      ...question.email,
    },
    {
      id: "phone",
      placeholder: "Phone",
      ...question.phone,
    },
    {
      id: "company",
      placeholder: "Company",
      ...question.company,
    },
  ];

  // const safeValue = useMemo(() => {
  //   return Array.isArray(value) ? value : ["", "", "", "", "", ""];
  // }, [value]);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    const containsAllEmptyStrings = value?.length === 6 && value.every((item) => item.trim() === "");
    if (containsAllEmptyStrings) {
      onSubmit({ [question.id]: [] }, updatedTtc);
    } else {
      onSubmit({ [question.id]: value ?? [] }, updatedTtc);
    }
  };

  // useEffect(() => {
  //   const filled = safeValue.some((val) => val.trim().length > 0);
  //   setHasFilled(filled);
  // }, [value, safeValue]);

  return (
    <form key={question.id} onSubmit={handleSubmit} className="fb-w-full" ref={formRef}>
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
        </div>
      </ScrollableContainer>
      <div className={`fb-flex fb-flex-col fb-space-y-4 fb-w-full fb-px-4`}>
        {fields.map(
          (field) =>
            field.show && <Input key={field.id} placeholder={field.placeholder} required={field.required} />
        )}
      </div>
      <div className="fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={8}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          tabIndex={7}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
        />
      </div>
    </form>
  );
};
