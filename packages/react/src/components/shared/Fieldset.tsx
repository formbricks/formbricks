import clsx from "clsx";
import React from "react";

interface FieldsetProps {
  name: string;
  fieldsetClassName?: string;
  children: React.ReactNode;
}

export function Fieldset({ name, fieldsetClassName, children }: FieldsetProps) {
  return (
    <fieldset className={clsx("formbricks-fieldset", fieldsetClassName)} name={name}>
      {children}
    </fieldset>
  );
}
