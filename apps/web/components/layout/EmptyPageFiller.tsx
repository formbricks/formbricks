import React from "react";
import StandardButton from "../StandardButton";

interface Props {
  children: React.ReactNode;
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
    <div
      className={
        `border-ui-gray-light mx-auto mt-8 rounded-lg border bg-white p-8 text-center ` + borderStyles
      }>
      {children}
      <h3 className="text-ui-gray-medium mt-5 text-base font-bold">{alertText}</h3>
      <p className="text-ui-gray-medium mt-1 text-xs font-light">{hintText}</p>
      {hasButton && (
        <div className="mt-6">
          <StandardButton onClick={onClick}>{buttonText}</StandardButton>
        </div>
      )}
    </div>
  );
};

export default EmptyPageFiller;
