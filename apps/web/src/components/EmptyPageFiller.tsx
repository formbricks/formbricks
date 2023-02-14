"use client";

import { Button } from "@formbricks/ui";
import React from "react";

interface Props {
  children?: React.ReactNode;
  onClick?: () => void;
  alertText: string;
  hintText: string;
  buttonText?: string;
  borderStyles?: string;
  hasButton?: boolean;
}

const EmptyPageFiller: React.FC<Props> = ({
  children,
  onClick = () => {},
  alertText,
  hintText,
  buttonText,
  borderStyles,
  hasButton = false,
}) => {
  return (
    <div className={`mx-auto mt-8 rounded-lg border border-slate-200 p-8 text-center ` + borderStyles}>
      {children}
      <h3 className="mt-5 text-base font-bold text-slate-400">{alertText}</h3>
      <p className="mt-1 text-xs font-light text-slate-400">{hintText}</p>
      {hasButton && (
        <div className="mt-6">
          <Button onClick={onClick}>{buttonText}</Button>
        </div>
      )}
    </div>
  );
};

export default EmptyPageFiller;
