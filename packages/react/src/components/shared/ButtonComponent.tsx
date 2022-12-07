import React from "react";
import { SVGComponent } from "../../types";

interface ButtonProps {
  elemId: string;
  label?: string;
  type?: "button" | "submit" | "reset";
  inputClassName?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  PrefixIcon?: SVGComponent;
  SuffixIcon?: SVGComponent;
  prefixIconClassName?: string;
  suffixIconClassName?: string;
}

export default function ButtonComponent({
  inputClassName,
  label,
  onClick,
  PrefixIcon,
  SuffixIcon,
  type = "button",
  elemId,
  prefixIconClassName,
  suffixIconClassName,
}: ButtonProps) {
  return (
    <button className={inputClassName || "formbricks-input"} type={type} id={elemId} onClick={onClick}>
      {PrefixIcon && <PrefixIcon className={prefixIconClassName || "formbricks-prefix-icon"} />}
      {label}
      {SuffixIcon && <SuffixIcon className={suffixIconClassName || "formbricks-suffix-icon"} />}
    </button>
  );
}
