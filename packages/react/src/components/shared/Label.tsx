import clsx from "clsx";
import React from "react";

interface LabelProps {
  label?: string;
  elemId: string;
  labelClassName?: string;
}

export function Label({ label, elemId, labelClassName }: LabelProps) {
  return (
    <>
      {typeof label !== "undefined" && (
        <label className={clsx("formbricks-label", labelClassName)} htmlFor={elemId}>
          {label}
        </label>
      )}
    </>
  );
}
