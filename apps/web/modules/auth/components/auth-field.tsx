import { cn } from "@/lib/cn";
import { Label } from "@/modules/ui/components/label";

interface AuthFieldProps {
  /** Id of the control inside, so the label and the messages attach to it. */
  id: string;
  label: React.ReactNode;
  /** Right-aligned next to the label, e.g. "Forgot your password?". */
  labelAction?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A labelled control with an optional hint and an inline error. The control sits in `children` and
 * should set `aria-describedby` to `${id}-hint` / `${id}-error` when it renders those.
 */
export const AuthField = ({
  id,
  label,
  labelAction,
  hint,
  error,
  className,
  children,
}: Readonly<AuthFieldProps>) => (
  <div className={cn("flex flex-col gap-2", className)}>
    {labelAction ? (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
    ) : (
      <Label htmlFor={id}>{label}</Label>
    )}
    {children}
    {hint && !error ? (
      <p id={`${id}-hint`} className="text-[13px] leading-[18px] text-slate-500">
        {hint}
      </p>
    ) : null}
    {error ? (
      <p id={`${id}-error`} role="alert" className="text-[13px] leading-[18px] text-red-600">
        {error}
      </p>
    ) : null}
  </div>
);
