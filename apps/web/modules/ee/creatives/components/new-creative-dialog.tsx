"use client";

import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
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
import { useCreateCreative } from "../hooks/use-creative-editor";
import { type TCreativeResourceType, buildNewCreativeRequest } from "../lib/editor-form";
import { getCreativeEditPath } from "../lib/paths";
import { CREATIVE_TYPE_ICONS } from "./creative-icons";

const TYPE_ICONS = {
  feedbackButton: CREATIVE_TYPE_ICONS.feedback_button,
  banner: CREATIVE_TYPE_ICONS.banner,
} satisfies Record<TCreativeResourceType, unknown>;

const TypeCard = ({
  type,
  title,
  description,
  isSelected,
  onSelect,
}: Readonly<{
  type: TCreativeResourceType;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}>) => {
  const Icon = TYPE_ICONS[type];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start gap-3 rounded-xl border bg-white p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden",
        isSelected
          ? "border-slate-900 shadow-[0_0_0_1px_var(--color-slate-900)]"
          : "border-slate-200 hover:border-slate-300"
      )}>
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          isSelected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
        )}>
        <Icon className="size-5" />
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </button>
  );
};

/** Picks a creative type, creates it as a Draft through API v3 and opens it in the editor. */
export const NewCreativeDialog = ({
  workspaceId,
  defaultLanguage,
}: Readonly<{ workspaceId: string; defaultLanguage: string }>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [type, setType] = useState<TCreativeResourceType>("feedbackButton");
  const createCreative = useCreateCreative();

  const create = () => {
    createCreative.mutate(
      buildNewCreativeRequest({
        workspaceId,
        type,
        name: t("workspace.creatives.untitled_creative"),
        label: t("workspace.creatives.editor.default_label"),
        defaultLanguage,
      }),
      {
        onSuccess: (creative) => router.push(getCreativeEditPath(workspaceId, creative.id)),
        onError: (error) =>
          toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))),
      }
    );
  };

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
            className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TypeCard
              type="feedbackButton"
              title={t("workspace.creatives.type_feedback_button")}
              description={t("workspace.creatives.type_feedback_button_description")}
              isSelected={type === "feedbackButton"}
              onSelect={() => setType("feedbackButton")}
            />
            <TypeCard
              type="banner"
              title={t("workspace.creatives.type_banner")}
              description={t("workspace.creatives.type_banner_description")}
              isSelected={type === "banner"}
              onSelect={() => setType("banner")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          {/* Stays busy until the editor replaces the list: the push only starts once the Draft exists. */}
          <Button onClick={create} loading={createCreative.isPending || createCreative.isSuccess}>
            {t("common.continue")}
            <ArrowRightIcon />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
