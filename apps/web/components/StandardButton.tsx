import React from "react";
import { classNames } from "../lib/utils";

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullwidth?: boolean;
  small?: boolean;
  icon?: boolean;
  secondary?: boolean;
  [key: string]: any;
}

// button component, consuming props
const StandardButton: React.FC<Props> = ({
  children,
  onClick = () => {},
  disabled = false,
  fullwidth = false,
  small = false,
  icon = false,
  secondary = false,
  ...rest
}) => {
  return (
    <button
      className={classNames(
        `inline-flex items-center rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2`,
        disabled ? "disabled:opacity-50" : "",
        fullwidth ? " w-full justify-center " : "",
        small ? "px-2.5 py-1.5 text-xs" : "px-5 py-3 text-sm",
        icon ? "px-1.5 py-1.5 text-xs" : "px-5 py-3 text-sm",
        secondary ? "bg-ui-gray-light text-red" : "bg-snoopfade text-white"
      )}
      onClick={onClick}
      disabled={disabled}
      {...rest}>
      {children}
    </button>
  );
};

export default StandardButton;
