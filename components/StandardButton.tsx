import React from "react";

interface Props {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  fullwidth?: boolean;
}

// button component, consuming props
const Button: React.FC<Props> = ({
  children,
  onClick,
  disabled,
  fullwidth,
  ...rest
}) => {
  return (
    <button
      className={
        `inline-flex items-center px-4 py-2 text-sm text-white border border-transparent rounded shadow-sm bg-snoopfade focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-snoopred-500 ` +
        (disabled ? " disabled" : "") +
        (fullwidth ? " w-full justify-center " : "")
      }
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
