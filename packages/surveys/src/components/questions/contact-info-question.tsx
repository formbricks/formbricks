// @ts-nocheck
import { useCallback, useMemo, useRef, useState } from "react";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyContactInfoQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { Input } from "../general/input";
import { Label } from "../general/label";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

interface ContactInfoQuestionProps {
  question: TSurveyContactInfoQuestion;
  survey: TJsEnvironmentStateSurvey;
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
  currentQuestionId: TSurveyQuestionId;
  autoFocusEnabled: boolean;
  isBackButtonHidden: boolean;
}

export function ContactInfoQuestion({
  question,
  survey,
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
  autoFocusEnabled,
  isBackButtonHidden,
}: ContactInfoQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const formRef = useRef<HTMLFormElement>(null);
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const isCurrent = question.id === currentQuestionId;
  const safeValue = useMemo(() => {
    return Array.isArray(value) ? value : ["", "", "", "", ""];
  }, [value]);

  const fields = [
    {
      id: "firstName",
      ...question.firstName,
      label: question.firstName.placeholder[languageCode],
    },
    {
      id: "lastName",
      ...question.lastName,
      label: question.lastName.placeholder[languageCode],
    },
    {
      id: "email",
      ...question.email,
      label: question.email.placeholder[languageCode],
    },
    {
      id: "phone",
      ...question.phone,
      label: question.phone.placeholder[languageCode],
    },
    {
      id: "company",
      ...question.company,
      label: question.company.placeholder[languageCode],
    },
  ];

  const handleChange = (fieldId: string, fieldValue: string) => {
    const newValue = fields.map((field) => {
      if (field.id === fieldId) {
        return fieldValue;
      }
      const existingValue = safeValue[fields.findIndex((f) => f.id === field.id)] || "";
      return field.show ? existingValue : "";
    });
    onChange({ [question.id]: newValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    const containsAllEmptyStrings = safeValue.length === 5 && safeValue.every((item) => item.trim() === "");
    if (containsAllEmptyStrings) {
      onSubmit({ [question.id]: [] }, updatedTtc);
    } else {
      onSubmit({ [question.id]: safeValue }, updatedTtc);
    }
  };

  const contactInfoRef = useCallback(
    (currentElement: HTMLInputElement | null) => {
      // will focus on current element when the question ID matches the current question
      if (question.id && currentElement && autoFocusEnabled && question.id === currentQuestionId) {
        currentElement.focus();
      }
    },
    [question.id, autoFocusEnabled, currentQuestionId]
  );

  return (
    <form key={question.id} onSubmit={handleSubmit} className="w-full" ref={formRef}>
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
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />

          <div className="mt-4 flex w-full flex-col space-y-2">
            {fields.map((field, index) => {
              const isFieldRequired = () => {
                if (field.required) {
                  return true;
                }

                // if all fields are optional and the question is required, then the fields should be required
                if (
                  fields.filter((currField) => currField.show).every((currField) => !currField.required) &&
                  question.required
                ) {
                  return true;
                }

                return false;
              };

              let inputType = "text";
              if (field.id === "email") {
                inputType = "email";
              } else if (field.id === "phone") {
                inputType = "number";
              }

              return (
                field.show && (
                  <div className="space-y-1">
                    <Label text={isFieldRequired() ? `${field.label}*` : field.label} />
                    <Input
                      ref={index === 0 ? contactInfoRef : null}
                      key={field.id}
                      required={isFieldRequired()}
                      value={safeValue[index] || ""}
                      type={inputType}
                      onChange={(e) => {
                        handleChange(field.id, e.currentTarget.value);
                      }}
                      tabIndex={isCurrent ? 0 : -1}
                      aria-label={field.label}
                    />
                  </div>
                )
              );
            })}
          </div>
        </div>
      </ScrollableContainer>

      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        {!isFirstQuestion && !isBackButtonHidden ? (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        ) : (
          <div />
        )}
        <div />
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
      </div>
    </form>
  );
}
