import clsx from "clsx";
import React from "react";
import { FieldErrorsImpl, useFormContext } from "react-hook-form";
import { Help } from "./Help";
import { Messages } from "./Messages";

interface OuterProps {
  inputType: string;
  outerClassName?: string;
  children: React.ReactNode;
}

export function Outer({ inputType, outerClassName, children }: OuterProps) {
  const {
    formState: { errors },
  } = useFormContext();
  return (
    <div className={clsx("formbricks-outer", outerClassName)} data-type={inputType}>
      {children}
    </div>
  );
}
