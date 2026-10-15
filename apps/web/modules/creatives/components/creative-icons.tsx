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

/** Same look as the surveys list's type column: a small icon and the type's name. */
export const CreativeTypeIndicator = ({ type }: Readonly<{ type: TCreativeType }>) => {
  const { t } = useTranslation();
  const Icon = CREATIVE_TYPE_ICONS[type];
  const labels: Record<TCreativeType, string> = {
    feedback_button: t("workspace.creatives.type_feedback_button"),
    banner: t("workspace.creatives.type_banner"),
  };
  return (
    <div className="flex items-center gap-x-2 text-sm whitespace-nowrap text-slate-600">
      <Icon className="size-4 shrink-0" />
      <span>{labels[type]}</span>
    </div>
  );
};
