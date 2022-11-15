import React from "react";
import { useFormContext } from "react-hook-form";
import { UniversalInputProps } from "../Formbricks";
import { Label } from "../shared/Label";

export interface TextInputUniqueProps {
  maxLength: number;
  minLength: number;
  placeholder: string;
}

type TextareaProps = UniversalInputProps & TextInputUniqueProps;

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
  return (
    <>
      <Label label={label} elemId={elemId} />
      <div className="formbricks-inner">
        <textarea
          className="formbricks-input"
          id={elemId}
          placeholder={placeholder || ""}
          {...(register(name), { required: validation?.includes("required"), minLength, maxLength })}
        />
      </div>
    </>
  );
}
