import { useMemo, useRef, useState } from "preact/hooks";
import { useCallback } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyAddressElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Input } from "@/components/general/input";
import { Label } from "@/components/general/label";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface AddressElementProps {
  element: TSurveyAddressElement;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
  autoFocusEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function AddressElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  autoFocusEnabled,
  dir = "auto",
}: Readonly<AddressElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  const formRef = useRef<HTMLFormElement>(null);

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);

  const safeValue = useMemo(() => {
    return Array.isArray(value) ? value : ["", "", "", "", "", ""];
  }, [value]);

  const fields = useMemo(
    () => [
      {
        id: "addressLine1",
        ...element.addressLine1,
        label: element.addressLine1.placeholder[languageCode],
      },
      {
        id: "addressLine2",
        ...element.addressLine2,
        label: element.addressLine2.placeholder[languageCode],
      },
      {
        id: "city",
        ...element.city,
        label: element.city.placeholder[languageCode],
      },
      {
        id: "state",
        ...element.state,
        label: element.state.placeholder[languageCode],
      },
      {
        id: "zip",
        ...element.zip,
        label: element.zip.placeholder[languageCode],
      },
      {
        id: "country",
        ...element.country,
        label: element.country.placeholder[languageCode],
      },
    ],
    [
      element.addressLine1,
      element.addressLine2,
      element.city,
      element.state,
      element.zip,
      element.country,
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
    onChange({ [element.id]: newValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  const addressRef = useCallback(
    (currentElement: HTMLInputElement | null) => {
      // will focus on current element when the element ID matches the current element
      if (element.id && currentElement && autoFocusEnabled && element.id === currentElementId) {
        currentElement.focus();
      }
    },
    [element.id, autoFocusEnabled, currentElementId]
  );

  const isFieldRequired = useCallback(
    (field: (typeof fields)[number]) => {
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
    },
    [fields, element.required]
  );

  return (
    <form key={element.id} onSubmit={handleSubmit} className="fb-w-full" ref={formRef}>
      <div>
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
                    tabIndex={0}
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
