import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { Headline } from "@/components/general/headline";
import { Input } from "@/components/general/input";
import { Label } from "@/components/general/label";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface ContactInfoQuestionProps {
  question: TSurveyContactInfoElement;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentQuestionId: string;
  autoFocusEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function ContactInfoQuestion({
  question,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  autoFocusEnabled,
  dir = "auto",
}: Readonly<ContactInfoQuestionProps>) {
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
    <form key={question.id} onSubmit={handleSubmit} className="fb-w-full" ref={formRef}>
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
              <div className="fb-space-y-1">
                <Label htmlForId={field.id} text={isFieldRequired() ? `${field.label}*` : field.label} />
                <Input
                  id={field.id}
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
                  dir={!safeValue[index] ? dir : "auto"}
                />
              </div>
            )
          );
        })}
      </div>
    </form>
  );
}
