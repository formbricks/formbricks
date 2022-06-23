import React from "react";
import { classNames } from "../lib/utils";

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullwidth?: boolean;
  [key: string]: any;
}

// button component, consuming props
const StandardButton: React.FC<Props> = ({
  children,
  onClick = () => {},
  disabled = false,
  fullwidth = false,
  ...rest
}) => {
  return (
    <button
      className={classNames(
        `inline-flex items-center px-5 py-3 text-sm text-white rounded shadow-sm bg-snoopfade focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`,
        disabled ? "disabled:opacity-50" : "",
        fullwidth ? " w-full justify-center " : ""
      )}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default StandardButton;
