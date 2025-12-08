import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Input } from "@/components/general/input";
import { Label } from "@/components/general/label";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface ContactInfoElementProps {
  element: TSurveyContactInfoElement;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
  autoFocusEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function ContactInfoElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  autoFocusEnabled,
  dir = "auto",
}: Readonly<ContactInfoElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  const formRef = useRef<HTMLFormElement>(null);
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);
  const safeValue = useMemo(() => {
    return Array.isArray(value) ? value : ["", "", "", "", ""];
  }, [value]);

  const fields = [
    {
      id: "firstName",
      ...element.firstName,
      label: element.firstName.placeholder[languageCode],
    },
    {
      id: "lastName",
      ...element.lastName,
      label: element.lastName.placeholder[languageCode],
    },
    {
      id: "email",
      ...element.email,
      label: element.email.placeholder[languageCode],
    },
    {
      id: "phone",
      ...element.phone,
      label: element.phone.placeholder[languageCode],
    },
    {
      id: "company",
      ...element.company,
      label: element.company.placeholder[languageCode],
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
    onChange({ [element.id]: newValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  const contactInfoRef = useCallback(
    (currentElement: HTMLInputElement | null) => {
      // will focus on current element when the element ID matches the current element
      if (element.id && currentElement && autoFocusEnabled && element.id === currentElementId) {
        currentElement.focus();
      }
    },
    [element.id, autoFocusEnabled, currentElementId]
  );

  return (
    <form key={element.id} onSubmit={handleSubmit} className="fb-w-full" ref={formRef}>
      {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader
        subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
        elementId={element.id}
      />

      <div className="fb-flex fb-flex-col fb-space-y-2 fb-mt-4 fb-w-full">
        {fields.map((field, index) => {
          const isFieldRequired = () => {
            if (field.required) {
              return true;
            }

            // if all fields are optional and the element is required, then the fields should be required
            if (
              fields.filter((currField) => currField.show).every((currField) => !currField.required) &&
              element.required
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
                  tabIndex={0}
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
