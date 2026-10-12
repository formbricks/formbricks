"use client";

import { useTranslation } from "react-i18next";
import { type TOutboundSurvey, isRestrictedSurveyPick } from "@/modules/survey/visibility/lib/outbound";
import { Badge } from "@/modules/ui/components/badge";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface RestrictedSurveyHintProps {
  /**
   * `restricted`: a picker's survey that cannot be attached. `paused`: a connection that serves a
   * restricted survey, whose responses dispatch skips.
   */
  kind: "restricted" | "paused";
}

/**
 * The one mark outbound surfaces (webhooks, integrations, feedback sources, workflows) put on a
 * restricted survey. The reason sits in a tooltip and is repeated for screen readers, because the
 * mark often lives inside a label or a row that is already a focus target.
 */
export const RestrictedSurveyHint = ({ kind }: Readonly<RestrictedSurveyHintProps>) => {
  const { t } = useTranslation();
  const label =
    kind === "restricted"
      ? t("workspace.surveys.visibility.restricted")
      : t("workspace.surveys.visibility.restricted_paused");
  const reason =
    kind === "restricted"
      ? t("workspace.surveys.visibility.outbound_restricted_tooltip")
      : t("workspace.surveys.visibility.outbound_paused_tooltip");

  return (
    <>
      <TooltipRenderer triggerClass="inline-flex shrink-0" className="max-w-xs" tooltipContent={reason}>
        <Badge size="tiny" type="gray" text={label} />
      </TooltipRenderer>
      <span className="sr-only">{reason}</span>
    </>
  );
};

interface RestrictedSurveysNoteProps {
  surveyVisibilityEnabled: boolean;
  surveys: ReadonlyArray<TOutboundSurvey>;
  /** Surveys the connection already uses: they stay selectable, so they need no note. */
  attachedSurveyIds?: ReadonlyArray<string>;
}

/**
 * The visible reason under a survey picker that holds restricted surveys it cannot offer. A disabled
 * menu item takes no pointer events, so its own tooltip would never open; this says it once instead.
 */
export const RestrictedSurveysNote = ({
  surveyVisibilityEnabled,
  surveys,
  attachedSurveyIds,
}: Readonly<RestrictedSurveysNoteProps>) => {
  const { t } = useTranslation();
  const hasRestrictedPick = surveys.some((survey) =>
    isRestrictedSurveyPick(surveyVisibilityEnabled, survey, attachedSurveyIds)
  );
  if (!hasRestrictedPick) return null;
  return (
    <p className="m-1 text-xs text-slate-500">
      {t("workspace.surveys.visibility.outbound_restricted_tooltip")}
    </p>
  );
};
