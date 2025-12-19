import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { Label } from "@/components/general/label";

/**
 * Form field configuration
 */
export interface FormFieldConfig {
  /** Unique identifier for the field */
  id: string;
  /** Label text for the field */
  label: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Input type (text, email, tel, number, url, etc.) */
  type?: "text" | "email" | "tel" | "number" | "url";
  /** Whether this field is required */
  required?: boolean;
  /** Whether this field should be shown */
  show?: boolean;
}

interface FormFieldProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Array of form field configurations */
  fields: FormFieldConfig[];
  /** Current values as a record mapping field IDs to their values */
  value?: Record<string, string>;
  /** Callback function called when any field value changes */
  onChange: (value: Record<string, string>) => void;
  /** Whether the entire form is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
}

function FormField({
  elementId,
  headline,
  description,
  fields,
  value = {},
  onChange,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
  imageUrl,
  videoUrl,
}: Readonly<FormFieldProps>): React.JSX.Element {
  // Ensure value is always an object
  const currentValues = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- value can be undefined
    return value ?? {};
  }, [value]);

  // Determine if a field is required
  const isFieldRequired = (field: FormFieldConfig): boolean => {
    if (field.required) {
      return true;
    }

    // If all fields are optional and the form is required, then fields should be required
    const visibleFields = fields.filter((f) => f.show !== false);
    const allOptional = visibleFields.every((f) => !f.required);
    if (allOptional && required) {
      return true;
    }

    return false;
  };

  // Handle field value change
  const handleFieldChange = (fieldId: string, fieldValue: string): void => {
    onChange({
      ...currentValues,
      [fieldId]: fieldValue,
    });
  };

  // Get visible fields
  const visibleFields = fields.filter((field) => field.show !== false);

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      {/* Form Fields */}
      <div className="relative space-y-3">
        <ElementError errorMessage={errorMessage} dir={dir} />
        {visibleFields.map((field) => {
          const fieldRequired = isFieldRequired(field);
          const fieldValue = currentValues[field.id] ?? "";
          const fieldInputId = `${elementId}-${field.id}`;

          // Determine input type
          let inputType: "text" | "email" | "tel" | "number" | "url" = field.type ?? "text";
          if (field.id === "email" && !field.type) {
            inputType = "email";
          } else if (field.id === "phone" && !field.type) {
            inputType = "tel";
          }

          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={fieldInputId} variant="default">
                {fieldRequired ? `${field.label}*` : field.label}
              </Label>
              <Input
                id={fieldInputId}
                type={inputType}
                value={fieldValue}
                onChange={(e) => {
                  handleFieldChange(field.id, e.target.value);
                }}
                required={fieldRequired}
                disabled={disabled}
                dir={dir}
                aria-invalid={Boolean(errorMessage) || undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { FormField };
export type { FormFieldProps };
