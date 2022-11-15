import React from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "../shared/Label";

interface TextProps {
  name: string;
  label?: string;
  elemId: string;
  placeholder?: string;
}

export function Text({ name, label, elemId, placeholder }: TextProps) {
  const { register } = useFormContext();
  return (
    <>
      <Label label={label} elemId={elemId} />
      <div className="formbricks-inner">
        <input
          className="formbricks-input"
          type="text"
          id={elemId}
          placeholder={placeholder || ""}
          {...register(name)}
        />
      </div>
    </>
  );
}
