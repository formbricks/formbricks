interface LabelProps {
  label?: string;
  elemId: string;
  labelClassName?: string;
}

export function Label({ label, elemId, labelClassName }: LabelProps) {
  return (
    <>
      {typeof label !== "undefined" && (
        <label className={labelClassName || "formbricks-label"} htmlFor={elemId}>
          {label}
        </label>
      )}
    </>
  );
}
