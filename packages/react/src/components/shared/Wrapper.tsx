import clsx from "clsx";

interface WrapperProps {
  wrapperClassName?: string;
  children: React.ReactNode;
}

export function Wrapper({ wrapperClassName, children }: WrapperProps) {
  return <div className={clsx("formbricks-wrapper", wrapperClassName)}>{children}</div>;
}
