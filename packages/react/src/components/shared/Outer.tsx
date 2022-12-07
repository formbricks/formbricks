interface OuterProps {
  inputType: string;
  outerClassName?: string;
  children: React.ReactNode;
}

export function Outer({ inputType, outerClassName, children }: OuterProps) {
  return (
    <div className={outerClassName || "formbricks-outer"} data-type={inputType}>
      {children}
    </div>
  );
}
