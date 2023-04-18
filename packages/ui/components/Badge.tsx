import { cn } from "@formbricks/lib/cn";

type SVGComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

interface BadgeProps {
  text: string;
  type: "warning" | "success" | "error" | "gray";
  size: "tiny" | "normal" | "large";
  StartIcon?: SVGComponent;
  startIconClassName?: string;
  className?: string;
}

export function Badge({ text, type, size, StartIcon, startIconClassName, className }: BadgeProps) {
  const bgColor = {
    warning: "bg-amber-100",
    success: "bg-green-100",
    error: "bg-red-100",
    gray: "bg-slate-100",
  };

  const textColor = {
    warning: "text-amber-800",
    success: "text-green-800",
    error: "text-red-800",
    gray: "text-slate-600",
  };

  const padding = {
    tiny: "px-1.5 py-0.5",
    normal: "px-2.5 py-0.5",
    large: "px-3.5 py-1",
  };

  const textSize = size === "large" ? "text-sm" : "text-xs";

  return (
    <span
      className={cn(
        "inline-flex cursor-default items-center rounded-full font-medium",
        bgColor[type],
        textColor[type],
        padding[size],
        textSize,
        className
      )}>
      {StartIcon && (
        <StartIcon
          className={cn("inline", "h-3 w-3 ltr:mr-2 rtl:-mr-1 rtl:ml-2", startIconClassName || "")}
        />
      )}
      {text}
    </span>
  );
}
