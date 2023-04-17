import { cn } from "@formbricks/lib/cn";

interface BadgeProps {
  text: string;
  type: "warning" | "success" | "error" | "gray";
  size: "tiny" | "normal" | "large";
  className?: string;
}

export function Badge({ text, type, size, className }: BadgeProps) {
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
      {text}
    </span>
  );
}
