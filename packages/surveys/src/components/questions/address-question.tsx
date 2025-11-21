import { useMemo, useRef, useState } from "preact/hooks";
import { useCallback } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyAddressElement } from "@formbricks/types/surveys/elements";
import { Headline } from "@/components/general/headline";
import { Input } from "@/components/general/input";
import { Label } from "@/components/general/label";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface AddressQuestionProps {
  question: TSurveyAddressElement;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentQuestionId: string;
  autoFocusEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function AddressQuestion({
  question,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  autoFocusEnabled,
  dir = "auto",
}: Readonly<AddressQuestionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const formRef = useRef<HTMLFormElement>(null);

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const safeValue = useMemo(() => {
    return Array.isArray(value) ? value : ["", "", "", "", "", ""];
  }, [value]);

  const isCurrent = question.id === currentQuestionId;

  const fields = useMemo(
    () => [
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
    ],
    [
      question.addressLine1,
      question.addressLine2,
      question.city,
      question.state,
      question.zip,
      question.country,
      languageCode,
    ]
  );

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

  const isFieldRequired = useCallback(
    (field: (typeof fields)[number]) => {
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
    },
    [fields, question.required]
  );

  return (
    <form key={question.id} onSubmit={handleSubmit} className="fb-w-full" ref={formRef}>
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

        <div className="fb-flex fb-flex-col fb-space-y-2 fb-mt-4 fb-w-full">
          {fields.map((field, index) => {
            const isRequired = isFieldRequired(field);

            return (
              field.show && (
                <div className="fb-space-y-1" key={field.id}>
                  <Label htmlForId={field.id} text={isRequired ? `${field.label}*` : field.label} />
                  <Input
                    id={field.id}
                    required={isRequired}
                    value={safeValue[index] || ""}
                    type="text"
                    onChange={(e) => {
                      handleChange(field.id, e.currentTarget.value);
                    }}
                    ref={index === 0 ? addressRef : null}
                    tabIndex={isCurrent ? 0 : -1}
                    aria-label={field.label}
                    dir={!safeValue[index] ? dir : "auto"}
                  />
                </div>
              )
            );
          })}
        </div>
      </div>
    </form>
  );
}
