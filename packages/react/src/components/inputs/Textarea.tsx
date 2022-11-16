import React from "react";
import { useFormContext } from "react-hook-form";
import { getValidationRules } from "../../lib/validation";
import { UniversalInputProps } from "../Formbricks";
import { Label } from "../shared/Label";

export interface TextareaInputUniqueProps {
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
}

type TextareaProps = UniversalInputProps & TextareaInputUniqueProps;

export function Textarea({
  name,
  label,
  elemId,
  placeholder,
  validation,
  minLength = 0,
  maxLength = 524288,
}: TextareaProps) {
  const { register } = useFormContext();
  const validationRules = getValidationRules(validation);

  if (!name) {
    console.error("🧱 Fomrbricks Error: Textarea has no name attribute");
    return <div></div>;
  }

  return (
    <>
      <Label label={label} elemId={elemId} />
      <div className="formbricks-inner">
        <textarea
          className="formbricks-input"
          id={elemId}
          placeholder={placeholder || ""}
          {...register(name, {
            required: validationRules?.includes("required"),
            minLength,
            maxLength,
          })}
        />
      </div>
    </>
  );
}
