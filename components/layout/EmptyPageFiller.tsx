import React from "react";
import Button from "../StandardButton.tsx";

interface Props {
  children: React.ReactNode;
  onClick: () => void;
  alertText: string;
  hintText: string;
  buttonText: string;
  borderStyles: string;
}

const EmptyPageFiller: React.FC<Props> = ({
  children,
  onClick,
  alertText,
  hintText,
  buttonText,
  borderStyles,
  ...rest
}) => {
  return (
    <div
      className={
        `bg-white max-w-md p-8 mx-auto mt-8 rounded-lg ` + borderStyles
      }
    >
      {children}
      <h3 className="mt-5 text-base font-bold text-lightgray-700">
        {alertText}
      </h3>
      <p className="mt-1 text-xs font-light text-lightgray-700">{hintText}</p>
      <div className="mt-6">
        <Button onClick={onClick}>{buttonText}</Button>
      </div>
    </div>
  );
};

export default EmptyPageFiller;
