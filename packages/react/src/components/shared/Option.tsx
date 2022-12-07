interface OptionProps {
  optionClassName?: string;
  children: React.ReactNode;
}

export function Option({ optionClassName, children }: OptionProps) {
  return <div className={optionClassName || "formbricks-option"}>{children}</div>;
}
