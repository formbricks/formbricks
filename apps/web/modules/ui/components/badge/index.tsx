import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface BadgeProps {
  text: string;
  type: "warning" | "success" | "error" | "gray" | "info";
  size: "tiny" | "normal" | "large";
  className?: string;
  role?: string;
  /** A leading icon (ENG-3632), e.g. the eye of a show-if badge. Sized to the text. */
  icon?: ReactNode;
  /** A trailing icon, e.g. a chevron on a badge that opens a popover. */
  trailingIcon?: ReactNode;
  /** Makes the badge a button that opens what it labels, in place. */
  onClick?: () => void;
  /** The accessible name of a clickable badge, when the text alone doesn't say what clicking does. */
  "aria-label"?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  type,
  size,
  className,
  role,
  icon,
  trailingIcon,
  onClick,
  "aria-label": ariaLabel,
  title,
}) => {
  const bgColor = {
    warning: "bg-amber-100",
    success: "bg-green-50",
    error: "bg-red-100",
    gray: "bg-slate-100",
    info: "bg-slate-100",
  };

  const borderColor = {
    warning: "border-amber-200",
    success: "border-green-600",
    error: "border-red-200",
    gray: "border-slate-200",
    info: "border-slate-200",
  };

  const textColor = {
    warning: "text-amber-800",
    success: "text-green-800",
    error: "text-red-800",
    gray: "text-slate-600",
    info: "text-slate-600",
  };

  const padding = {
    tiny: "px-1.5 py-0.5",
    normal: "px-2.5 py-0.5",
    large: "px-3.5 py-1",
  };

  const textSize = size === "large" ? "text-sm" : "text-xs";
  const iconSize = size === "large" ? "[&_svg]:size-3.5" : "[&_svg]:size-3";

  const classes = cn(
    "inline-flex items-center gap-1 rounded-full border font-medium [&_svg]:shrink-0",
    iconSize,
    bgColor[type],
    borderColor[type],
    textColor[type],
    padding[size],
    textSize,
    onClick
      ? "cursor-pointer hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
      : "cursor-default",
    className
  );

  const content = (
    <>
      {icon}
      {text}
      {trailingIcon}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        role={role}
        className={classes}
        aria-label={ariaLabel}
        title={title}
        onClick={(event) => {
          // A badge sits inside clickable rows; opening it must not also toggle the row.
          event.stopPropagation();
          onClick();
        }}>
        {content}
      </button>
    );
  }

  return (
    <span role={role} className={classes} aria-label={ariaLabel} title={title}>
      {content}
    </span>
  );
};
