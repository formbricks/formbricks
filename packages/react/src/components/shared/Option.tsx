import clsx from "clsx";

interface OptionProps {
  optionClassName?: string;
  children: React.ReactNode;
}

export function Option({ optionClassName, children }: OptionProps) {
  return <div className={clsx("formbricks-option", optionClassName)}>{children}</div>;
}
