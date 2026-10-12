"use client";

import { LockIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TRestrictedAuthor } from "@/modules/survey/visibility/lib/collaborate";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface RestrictedVisibilityMarkerProps {
  /** Who the survey is restricted to, besides the organization's owners and managers. */
  author: TRestrictedAuthor;
  /** The survey name the marker precedes. */
  children: ReactNode;
}

const useRestrictedAudience = (author: TRestrictedAuthor): string => {
  const { t } = useTranslation();
  switch (author.kind) {
    case "you":
      return t("workspace.surveys.visibility.restricted_marker_you");
    case "named":
      return t("workspace.surveys.visibility.restricted_marker_author", { author: author.name });
    default:
      return t("workspace.surveys.visibility.restricted_marker_no_author");
  }
};

/**
 * The survey list's mark for a restricted survey, the counterpart of `WorkspaceVisibilityMarker`. It
 * sits inside the row's link, so icon and name stay one focus target; the label follows the name for
 * screen readers, so the link is announced as "{name}, Restricted".
 */
export const RestrictedVisibilityMarker = ({
  author,
  children,
}: Readonly<RestrictedVisibilityMarkerProps>) => {
  const { t } = useTranslation();
  const label = t("workspace.surveys.visibility.restricted");
  const audience = useRestrictedAudience(author);

  return (
    <>
      <TooltipRenderer
        triggerClass="mr-1.5 flex shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100"
        className="max-w-xs"
        tooltipContent={
          <div className="space-y-1">
            <p className="font-medium text-slate-800">{label}</p>
            <p className="text-slate-500">{audience}</p>
          </div>
        }>
        <LockIcon className="size-4" aria-hidden="true" />
      </TooltipRenderer>
      {children}
      <span className="sr-only">{`, ${label}`}</span>
    </>
  );
};
