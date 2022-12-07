interface OptionsProps {
  optionsClassName?: string;
  children: React.ReactNode;
}

export function Options({ optionsClassName, children }: OptionsProps) {
  return <div className={optionsClassName || "formbricks-options"}>{children}</div>;
}
