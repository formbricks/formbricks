import clsx from "clsx";
import React from "react";

interface OptionsProps {
  optionsClassName?: string;
  children: React.ReactNode;
}

export function Options({ optionsClassName, children }: OptionsProps) {
  return <div className={clsx("formbricks-options", optionsClassName)}>{children}</div>;
}
