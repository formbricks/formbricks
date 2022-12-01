import clsx from "clsx";
import React from "react";

interface InnerProps {
  innerClassName?: string;
  children: React.ReactNode;
}

export function Inner({ innerClassName, children }: InnerProps) {
  return <div className={innerClassName || "formbricks-inner"}>{children}</div>;
}
