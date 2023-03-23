import clsx from "clsx";

interface BadgeProps {
  text: string;
  type: "warning" | "success" | "error";
  size: "tiny" | "normal" | "large";
}

export default function Badge({ text, type, size }: BadgeProps) {
  const bgColor = {
    warning: "bg-amber-100",
    success: "bg-green-100",
    error: "bg-red-100",
  };

  const textColor = {
    warning: "text-amber-800",
    success: "text-green-800",
    error: "text-red-800",
  };

  const padding = {
    tiny: "px-1.5 py-0.5",
    normal: "px-2.5 py-0.5",
    large: "px-3.5 py-1",
  };

  const textSize = size === "large" ? "text-sm" : "text-xs";

  return (
    <span
      className={clsx(
        "ml-2 inline-flex items-center rounded-full font-medium",
        bgColor[type],
        textColor[type],
        padding[size],
        textSize
      )}>
      {text}
    </span>
  );
}
