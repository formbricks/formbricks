import clsx from "clsx";
import React from "react";

interface InnerProps {
  innerClassName?: string;
  children: React.ReactNode;
}

export function Inner({ innerClassName, children }: InnerProps) {
  return <div className={clsx("formbricks-inner", innerClassName)}>{children}</div>;
}
