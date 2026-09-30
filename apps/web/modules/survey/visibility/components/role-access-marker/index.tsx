"use client";

import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface RoleAccessMarkerProps {
  /** `role`: seen only through the organization role. `author_gone`: the author has no account any more. */
  kind: "role" | "author_gone";
  workspaceName: string;
}

/**
 * The extra detail after a restricted survey's name, next to its restricted marker. Like that marker it
 * lives inside the row's link, so the tooltip text is repeated for screen readers rather than made a
 * second focus target.
 */
export const RoleAccessMarker = ({ kind, workspaceName }: Readonly<RoleAccessMarkerProps>) => {
  const { t } = useTranslation();
  const text =
    kind === "role"
      ? t("workspace.surveys.visibility.role_access_tooltip")
      : t("workspace.surveys.visibility.author_gone_tooltip", { workspace: workspaceName });
  const Icon = kind === "role" ? InfoIcon : TriangleAlertIcon;

  return (
    <>
      <TooltipRenderer
        triggerClass={
          kind === "role"
            ? "ml-1.5 flex shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100"
            : "ml-1.5 flex shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-100"
        }
        className="max-w-xs"
        tooltipContent={text}>
        <Icon className="size-4" aria-hidden="true" />
      </TooltipRenderer>
      <span className="sr-only">{`, ${text}`}</span>
    </>
  );
};

interface MakeVisibleToWorkspaceButtonProps {
  workspaceName: string;
  onClick: () => void;
  loading?: boolean;
}

/**
 * The author-gone row's one-click way out. Restricted → visible never needs a confirmation, so this
 * changes the visibility directly.
 */
export const MakeVisibleToWorkspaceButton = ({
  workspaceName,
  onClick,
  loading = false,
}: Readonly<MakeVisibleToWorkspaceButtonProps>) => {
  const { t } = useTranslation();

  return (
    <Button type="button" variant="secondary" size="sm" loading={loading} onClick={onClick}>
      {t("workspace.surveys.visibility.make_visible_to_workspace", { workspace: workspaceName })}
    </Button>
  );
};
