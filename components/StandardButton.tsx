import React from "react";

interface Props {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  fullwidth?: boolean;
}

// button component, consuming props
const StandardButton: React.FC<Props> = ({
  children,
  onClick,
  disabled = false,
  fullwidth = false,
  ...rest
}) => {
  return (
    <button
      className={
        `inline-flex items-center px-5 py-3 text-sm text-white rounded shadow-sm bg-snoopfade focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ` +
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

export default StandardButton;
