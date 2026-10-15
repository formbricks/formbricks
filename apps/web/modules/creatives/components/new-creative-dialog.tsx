"use client";

import { ArrowRightIcon, LayersIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/modules/ui/components/dialog";
import { getNewCreativePath } from "../lib/paths";
import type { TCreativeType } from "../types";
import { CREATIVE_TYPE_ICONS } from "./creative-icons";

const TypeCard = ({
  icon,
  title,
  description,
  isSelected,
  disabledBadge,
  onSelect,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  description: string;
  isSelected: boolean;
  disabledBadge?: string;
  onSelect?: () => void;
}>) => (
  <button
    type="button"
    role="radio"
    aria-checked={isSelected}
    disabled={!onSelect}
    onClick={onSelect}
    className={cn(
      "relative flex flex-col items-start gap-3 rounded-xl border bg-white p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden",
      isSelected
        ? "border-slate-900 shadow-[0_0_0_1px_var(--color-slate-900)]"
        : "border-slate-200 hover:border-slate-300",
      !onSelect && "cursor-not-allowed bg-slate-50 opacity-70"
    )}>
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-lg",
        isSelected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
      )}>
      {icon}
    </span>
    <span className="space-y-1">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {title}
        {disabledBadge && (
          <span className="rounded-full border border-slate-200 bg-white px-1.5 py-px text-[11px] font-medium text-slate-500">
            {disabledBadge}
          </span>
        )}
      </span>
      <span className="block text-xs leading-relaxed text-slate-500">{description}</span>
    </span>
  </button>
);

export const NewCreativeDialog = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [type, setType] = useState<TCreativeType>("feedback_button");
  const FeedbackIcon = CREATIVE_TYPE_ICONS.feedback_button;
  const BannerIcon = CREATIVE_TYPE_ICONS.banner;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          {t("workspace.creatives.new_creative")}
        </Button>
      </DialogTrigger>
      <DialogContent width="wide">
        <DialogHeader>
          <DialogTitle>{t("workspace.creatives.new_creative")}</DialogTitle>
          <DialogDescription>{t("workspace.creatives.new_creative_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div
            role="radiogroup"
            aria-label={t("common.type")}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TypeCard
              icon={<FeedbackIcon className="size-5" />}
              title={t("workspace.creatives.type_feedback_button")}
              description={t("workspace.creatives.type_feedback_button_description")}
              isSelected={type === "feedback_button"}
              onSelect={() => setType("feedback_button")}
            />
            <TypeCard
              icon={<BannerIcon className="size-5" />}
              title={t("workspace.creatives.type_banner")}
              description={t("workspace.creatives.type_banner_description")}
              isSelected={type === "banner"}
              onSelect={() => setType("banner")}
            />
            <TypeCard
              icon={<LayersIcon className="size-5" />}
              title={t("workspace.creatives.type_drawer")}
              description={t("workspace.creatives.type_drawer_description")}
              isSelected={false}
              disabledBadge={t("workspace.creatives.coming_soon")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => router.push(getNewCreativePath(workspaceId, type))}>
            {t("common.continue")}
            <ArrowRightIcon />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
