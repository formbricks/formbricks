"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/modules/ui/components/button";
import { cn } from "@formbricks/lib/cn";

interface IconButtonProps {
    className?: string;
    icon: LucideIcon,
    label: string; 
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

export function IconButton({className="", icon, label, onClick}:IconButtonProps): React.JSX.Element {
  const Icon = icon;
  return (
    <Button aria-label={label} onClick={onClick} variant="ghost" className={cn("text-white hover:text-white hover:bg-white/10 h-6 w-6", className)}>
       <Icon className="h-4 w-4" strokeWidth={2} />
    </Button>
  );
}

export default IconButton;
