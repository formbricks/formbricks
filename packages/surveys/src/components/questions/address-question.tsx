// @ts-nocheck
import { useMemo, useRef, useState } from "react";
import { useCallback } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyAddressQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
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

interface AddressQuestionProps {
  question: TSurveyAddressQuestion;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentQuestionId: TSurveyQuestionId;
  autoFocusEnabled: boolean;
  isBackButtonHidden: boolean;
}

export function AddressQuestion({
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
  autoFocusEnabled,
  isBackButtonHidden,
}: AddressQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const formRef = useRef<HTMLFormElement>(null);
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const safeValue = useMemo(() => {
    return Array.isArray(value) ? value : ["", "", "", "", "", ""];
  }, [value]);
  const isCurrent = question.id === currentQuestionId;

  const fields = [
    {
      id: "addressLine1",
      ...question.addressLine1,
      label: question.addressLine1.placeholder[languageCode],
    },
    {
      id: "addressLine2",
      ...question.addressLine2,
      label: question.addressLine2.placeholder[languageCode],
    },
    {
      id: "city",
      ...question.city,
      label: question.city.placeholder[languageCode],
    },
    {
      id: "state",
      ...question.state,
      label: question.state.placeholder[languageCode],
    },
    {
      id: "zip",
      ...question.zip,
      label: question.zip.placeholder[languageCode],
    },
    {
      id: "country",
      ...question.country,
      label: question.country.placeholder[languageCode],
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
    const containsAllEmptyStrings = safeValue.length === 6 && safeValue.every((item) => item.trim() === "");
    if (containsAllEmptyStrings) {
      onSubmit({ [question.id]: [] }, updatedTtc);
    } else {
      onSubmit({ [question.id]: safeValue }, updatedTtc);
    }
  };

  const addressRef = useCallback(
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

              return (
                field.show && (
                  <div className="space-y-1">
                    <Label text={isFieldRequired() ? `${field.label}*` : field.label} />
                    <Input
                      key={field.id}
                      required={isFieldRequired()}
                      value={safeValue[index] || ""}
                      type={field.id === "email" ? "email" : "text"}
                      onChange={(e) => {
                        handleChange(field.id, e.currentTarget.value);
                      }}
                      ref={index === 0 ? addressRef : null}
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
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
        <div />
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        )}
      </div>
    </form>
  );
}
