import clsx from "clsx";

interface OuterProps {
  inputType: string;
  outerClassName?: string;
  children: React.ReactNode;
}

export function Outer({ inputType, outerClassName, children }: OuterProps) {
  return (
    <div className={clsx("formbricks-outer", outerClassName)} data-type={inputType}>
      {children}
    </div>
  );
}
