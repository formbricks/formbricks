"use client";

import { Button } from "@/modules/ui/components/button";
import { LucideIcon } from "lucide-react";
import React from "react";
import { cn } from "@formbricks/lib/cn";

type IconSize = "sm" | "md" | "lg";

interface IconButtonProps {
  className?: string;
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  iconSize?: IconSize;
}

export function IconButton({
  className = "",
  icon,
  label,
  loading = false,
  iconSize = "lg",
  onClick,
}: IconButtonProps): React.JSX.Element {
  const Icon = icon;

  const sizeStyles = {
    sm: "!h-4 !w-4",
    md: "!h-5 !w-5",
    lg: "!h-6 !w-6",
  };

  const iconSizeStyle = sizeStyles[iconSize];

  return (
    <Button
      aria-label={label}
      onClick={onClick}
      loading={loading}
      variant="ghost"
      // NOTE: The button has horizontal padding  so the exact size is not 24px (actual: 32x24)
      className={cn("h-6 w-6 text-gray-400 hover:bg-white/10 hover:text-gray-600", className)}>
      {/* TODO: Update component so that the Icon size is updated */}
      {/* Currently size is overridden by Button */}
      {/* Can use !h-4 !w-4 to force as alternative */}
      <Icon className={`h-4 w-4 md:${iconSizeStyle}`} strokeWidth={2} />
    </Button>
  );
}

export default IconButton;
