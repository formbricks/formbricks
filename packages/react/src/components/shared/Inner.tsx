import React from "react";
import clsx from "clsx";

interface InnerProps {
  innerClassName?: string;
  children: React.ReactNode;
}

export function Inner({ innerClassName, children }: InnerProps) {
  return <div className={clsx("formbricks-inner", innerClassName)}>{children}</div>;
}
