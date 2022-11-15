import React from "react";

interface LabelProps {
  label?: string;
  elemId: string;
}

export function Label({ label, elemId }: LabelProps) {
  return (
    <>
      {typeof label !== "undefined" && (
        <label className="formbricks-label" htmlFor={elemId}>
          {label}
        </label>
      )}
    </>
  );
}
