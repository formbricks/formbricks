"use client";

import {
  type LucideIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PanelTopIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CreativeTypeZodType } from "@formbricks/api-v3-schemas";
import { cn } from "@/lib/cn";
import type { TCreativeIcon, TCreativeType } from "../types";

/** The icons are keyed by the mock's type names; the API's names map through this. */
const ICON_TYPES: Record<CreativeTypeZodType, TCreativeType> = {
  feedbackButton: "feedback_button",
  banner: "banner",
};

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

/**
 * The type's icon, set before a creative's name (list rows, the editor and summary headers). The type's
 * name is there for screen readers only: the icon says it to everyone else.
 */
export const CreativeTypeIcon = ({
  type,
  className,
}: Readonly<{ type: CreativeTypeZodType; className?: string }>) => {
  const { t } = useTranslation();
  const Icon = CREATIVE_TYPE_ICONS[ICON_TYPES[type]];
  const labels: Record<CreativeTypeZodType, string> = {
    feedbackButton: t("workspace.creatives.type_feedback_button"),
    banner: t("workspace.creatives.type_banner"),
  };
  return (
    <>
      <Icon className={cn("size-4 shrink-0 text-slate-500", className)} aria-hidden="true" />
      <span className="sr-only">{labels[type]}</span>
    </>
  );
};
