import clsx from "clsx";
import React from "react";

interface OuterProps {
  inputType: string;
  outerClassName?: string;
  children: React.ReactNode;
}

export function Outer({ inputType, outerClassName, children }: OuterProps) {
  return (
    <div className={clsx("formbricks-outer", outerClassName)} data-type={inputType}>
      {children}
    </div>
  );
}
