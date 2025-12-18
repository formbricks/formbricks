import { useState } from "react";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { Textarea } from "@/components/general/textarea";
import { cn } from "@/lib/utils";

interface OpenTextProps {
  elementId: string;
  headline: string;
  description?: string;
  placeholder?: string;
  inputId: string;
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  longAnswer?: boolean;
  inputType?: "text" | "email" | "url" | "phone" | "number";
  charLimit?: {
    min?: number;
    max?: number;
  };
  errorMessage?: string;
  dir?: "ltr" | "rtl" | "auto";
  rows?: number;
  disabled?: boolean;
}

function OpenText({
  elementId,
  headline,
  description,
  placeholder,
  value = "",
  inputId,
  onChange,
  required = false,
  longAnswer = false,
  inputType = "text",
  charLimit,
  errorMessage,
  dir = "auto",
  rows = 3,
  disabled = false,
}: Readonly<OpenTextProps>): React.JSX.Element {
  const [currentLength, setCurrentLength] = useState(value.length);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const newValue = e.target.value;
    setCurrentLength(newValue.length);
    onChange(newValue);
  };

  const renderCharLimit = (): React.JSX.Element | null => {
    if (charLimit?.max === undefined) return null;
    const isOverLimit = currentLength >= charLimit.max;
    return (
      <span className={cn("text-xs", isOverLimit ? "font-semibold text-red-500" : "text-brand")}>
        {currentLength}/{charLimit.max}
      </span>
    );
  };

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Input or Textarea */}
      <div className="space-y-1">
        {longAnswer ? (
          <Textarea
            id={inputId}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            aria-required={required}
            dir={dir}
            rows={rows}
            disabled={disabled}
            errorMessage={errorMessage}
            minLength={charLimit?.min}
            maxLength={charLimit?.max}
          />
        ) : (
          <Input
            id={inputId}
            type={inputType}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            aria-required={required}
            dir={dir}
            disabled={disabled}
            errorMessage={errorMessage}
            minLength={charLimit?.min}
            maxLength={charLimit?.max}
          />
        )}
        {renderCharLimit()}
      </div>
    </div>
  );
}

export { OpenText };
export type { OpenTextProps };
