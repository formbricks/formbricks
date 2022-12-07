interface WrapperProps {
  wrapperClassName?: string;
  children: React.ReactNode;
}

export function Wrapper({ wrapperClassName, children }: WrapperProps) {
  return <div className={wrapperClassName || "formbricks-wrapper"}>{children}</div>;
}
