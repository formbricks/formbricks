import clsx from "clsx";
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
}

export default function ButtonComponent({
  inputClassName,
  label,
  onClick,
  PrefixIcon,
  SuffixIcon,
  type = "button",
  elemId,
}: ButtonProps) {
  return (
    <button className={inputClassName || "formbricks-input"} type={type} id={elemId} onClick={onClick}>
      {PrefixIcon && <PrefixIcon className={clsx("formbricks-prefix-icon")} />}
      {label}
      {SuffixIcon && <SuffixIcon className={clsx("formbricks-suffix-icon")} />}
    </button>
  );
}
