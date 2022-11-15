import React from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "../shared/Label";

interface TextareaProps {
  name: string;
  label?: string;
  elemId: string;
  placeholder?: string;
}

export function Textarea({ name, label, elemId, placeholder }: TextareaProps) {
  const { register } = useFormContext();
  return (
    <>
      <Label label={label} elemId={elemId} />
      <div className="formbricks-inner">
        <textarea
          className="formbricks-input"
          id={elemId}
          placeholder={placeholder || ""}
          {...register(name)}
        />
      </div>
    </>
  );
}
