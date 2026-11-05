"use client";

import { EyeOffIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TOptionListKey } from "@formbricks/types/surveys/show-if";
import { cn } from "@/lib/cn";
import { getHideToggle, getHideToggleToast } from "@/modules/survey/editor/lib/option-hide-toggle";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/** Hides an option, matrix row or matrix column, or shows it again (ENG-6949). */
export type TSetOptionHidden = (listKey: TOptionListKey, optionId: string, hidden: boolean) => void;

interface OptionHideButtonProps {
  readonly item: { id: string; hidden?: boolean };
  readonly listKey: TOptionListKey;
  readonly onSetHidden: TSetOptionHidden;
  /** The row's other icon buttons: secondary next to an option's, ghost next to a matrix row's. */
  readonly variant?: "secondary" | "ghost";
  readonly className?: string;
  /** Places the button, through the tooltip's wrapper (a picture's tile pins it to a corner). */
  readonly triggerClassName?: string;
}

/**
 * The Hide quick action next to an option's lock and delete (ENG-6949): an eye-off button, pressed
 * while the option is Hidden. It is never locked: on a live survey, hiding is how an option is retired.
 */
export const OptionHideButton = ({
  item,
  listKey,
  onSetHidden,
  variant = "secondary",
  className,
  triggerClassName,
}: OptionHideButtonProps) => {
  const { t } = useTranslation();
  const toggle = getHideToggle(item, listKey, t);

  return (
    <TooltipRenderer
      tooltipContent={toggle.tooltip}
      className="max-w-xs text-xs"
      triggerClass={triggerClassName}>
      <Button
        type="button"
        variant={variant}
        size="icon"
        aria-label={toggle.tooltip}
        aria-pressed={toggle.isHidden}
        data-testid="hide-option"
        className={cn(toggle.isHidden && "bg-slate-200 text-slate-900 hover:bg-slate-300", className)}
        onClick={(event) => {
          event.preventDefault();
          onSetHidden(listKey, item.id, toggle.nextHidden);
          toast.success(getHideToggleToast(listKey, toggle.nextHidden, t));
        }}>
        <EyeOffIcon />
      </Button>
    </TooltipRenderer>
  );
};

/** The Hidden badge the Flow tab uses, for a Hidden option's row in the Questions tab. */
export const HiddenOptionBadge = ({ className }: { readonly className?: string }) => {
  const { t } = useTranslation();
  return (
    <Badge
      type="gray"
      size="tiny"
      icon={<EyeOffIcon />}
      text={t("workspace.surveys.edit.flow.hidden_badge")}
      className={cn("shrink-0", className)}
    />
  );
};
