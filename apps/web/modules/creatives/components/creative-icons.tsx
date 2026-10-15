import {
  type LucideIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PanelTopIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { TCreativeIcon, TCreativeType } from "../types";

export const CREATIVE_TYPE_ICONS: Record<TCreativeType, LucideIcon> = {
  feedback_button: MessageSquareIcon,
  banner: PanelTopIcon,
};

export const CREATIVE_CONTENT_ICONS: Record<TCreativeIcon, LucideIcon> = {
  message_square: MessageSquareIcon,
  message_circle: MessageCircleIcon,
  megaphone: MegaphoneIcon,
  sparkles: SparklesIcon,
};

export const CreativeTypeIcon = ({
  type,
  className,
}: Readonly<{ type: TCreativeType; className?: string }>) => {
  const Icon = CREATIVE_TYPE_ICONS[type];
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600",
        className
      )}>
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  );
};
