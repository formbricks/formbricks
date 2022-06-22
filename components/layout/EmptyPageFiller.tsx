import React from "react";
import StandardButton from "../StandardButton";

interface Props {
  children: React.ReactNode;
  onClick: () => void;
  alertText: string;
  hintText: string;
  buttonText: string;
  borderStyles: string;
  button: boolean;
}

const EmptyPageFiller: React.FC<Props> = ({
  children,
  onClick,
  alertText,
  hintText,
  buttonText,
  borderStyles,
  button = false,
  ...rest
}) => {
  return (
    <div
      className={
        `bg-white border border-ui-gray-light text-center p-8 mx-auto mt-8 rounded-lg ` +
        borderStyles
      }
    >
      {children}
      <h3 className="mt-5 text-base font-bold text-ui-gray-medium">
        {alertText}
      </h3>
      <p className="mt-1 text-xs font-light text-ui-gray-medium">{hintText}</p>
      <div className={`mt-6` + (button ? " " : " hidden")}>
        <StandardButton onClick={onClick}>{buttonText}</StandardButton>
      </div>
    </div>
  );
};

export default EmptyPageFiller;
