"use client";

import { MoonIcon, SmartphoneIcon } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TStylingAppearance } from "@/lib/styling/dark-mode";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { useEditorTimeZone } from "@/modules/ui/components/date-time-picker";
import type { TCreativeEditorForm } from "../../lib/editor-form";
import {
  type TColorsSummary,
  type TCustomCssSummary,
  type TPositionSummary,
  type TShapeSummary,
  getScheduleSummaryFormat,
} from "../../lib/panel-summaries";
import type { TCreativeDevice } from "../../lib/styling-form";
import { getUiLocale } from "../../lib/ui-locale";

/** The summaries of folded editor panels (`EditorPanel`'s `fold.summary`). */

const SummaryText = ({ children, className }: Readonly<{ children: ReactNode; className?: string }>) => (
  <span className={cn("truncate", className)}>{children}</span>
);

const joinParts = (parts: (string | false)[]): string => parts.filter(Boolean).join(" · ");

/** Says the summary is for the dark appearance or the phone, as the preview is showing it. */
const ModeIcon = ({
  appearance,
  device,
}: Readonly<{ appearance?: TStylingAppearance; device?: TCreativeDevice }>) => {
  if (appearance === "dark") return <MoonIcon className="size-3 shrink-0" aria-hidden="true" />;
  if (device === "phone") return <SmartphoneIcon className="size-3 shrink-0" aria-hidden="true" />;
  return null;
};

// No border: a white swatch struck through, as colour pickers draw "none".
const NO_COLOR_SWATCH: CSSProperties = {
  background:
    "linear-gradient(to top right, #fff calc(50% - 0.75px), #ef4444 calc(50% - 0.75px), #ef4444 calc(50% + 0.75px), #fff calc(50% + 0.75px))",
};

const Swatch = ({ color }: Readonly<{ color: string | null }>) => (
  <span
    className="size-3.5 shrink-0 rounded-sm ring-1 ring-slate-900/15 ring-inset"
    style={color ? { backgroundColor: color } : NO_COLOR_SWATCH}
  />
);

export const ColorsSummary = ({
  summary,
  appearance,
  contrastRatio,
}: Readonly<{
  summary: TColorsSummary;
  appearance: TStylingAppearance;
  /** The settled contrast warning's ratio, as the card's own warning shows it. */
  contrastRatio: number | null;
}>) => {
  const { t } = useTranslation();
  if (summary.kind === "lookAndFeel") {
    return <SummaryText>{t("workspace.creatives.editor.summary_look_and_feel")}</SummaryText>;
  }
  const getText = () => {
    if (contrastRatio !== null) {
      return t("workspace.creatives.editor.summary_contrast", { ratio: contrastRatio.toFixed(1) });
    }
    if (summary.ownCount > 0) {
      return t("workspace.creatives.editor.summary_colors_set", { count: summary.ownCount });
    }
    // Dark colours left unset are derived from light, not taken from the workspace.
    return appearance === "dark"
      ? t("workspace.creatives.editor.automatic_value")
      : t("workspace.creatives.editor.workspace_value");
  };
  return (
    <>
      <ModeIcon appearance={appearance} />
      <span className="flex shrink-0 gap-0.5" aria-hidden="true">
        <Swatch color={summary.background} />
        <Swatch color={summary.text} />
        <Swatch color={summary.border} />
      </span>
      <SummaryText className={cn(contrastRatio !== null && "font-medium text-amber-700")}>
        {getText()}
      </SummaryText>
    </>
  );
};

export const ShapeSummary = ({
  summary,
  device,
}: Readonly<{ summary: TShapeSummary; device: TCreativeDevice }>) => {
  const { t } = useTranslation();
  if (summary.kind === "lookAndFeel") {
    return <SummaryText>{t("workspace.creatives.editor.summary_look_and_feel")}</SummaryText>;
  }
  const values = {
    font: summary.pageFont ? t("workspace.look.font_page") : t("workspace.look.font_survey"),
    fontSize: summary.fontSize,
  };
  return (
    <>
      <ModeIcon device={device} />
      <SummaryText>
        {summary.borderRadius === null
          ? t("workspace.creatives.editor.summary_shape_banner", values)
          : t("workspace.creatives.editor.summary_shape_feedback_button", {
              ...values,
              radius: summary.borderRadius,
            })}
      </SummaryText>
    </>
  );
};

export const PositionSummary = ({
  summary,
  device,
}: Readonly<{ summary: TPositionSummary; device: TCreativeDevice }>) => {
  const { t } = useTranslation();
  const edges = {
    left: t("workspace.creatives.editor.left"),
    right: t("workspace.creatives.editor.right"),
    top: t("workspace.creatives.editor.top"),
    bottom: t("workspace.creatives.editor.bottom"),
  };
  const getPlacementText = () => {
    if (summary.kind === "banner") {
      return t("workspace.creatives.editor.summary_position_banner", {
        edge: edges[summary.edge],
        layout:
          summary.layout === "inPage"
            ? t("workspace.creatives.editor.layout_in_page")
            : t("workspace.creatives.editor.layout_overlay"),
      });
    }
    const values = { edge: edges[summary.edge], offset: summary.offset };
    // A bottom button's offset runs from the left; a side one's from the top.
    return summary.edge === "bottom"
      ? t("workspace.creatives.editor.summary_position_from_left", values)
      : t("workspace.creatives.editor.summary_position_from_top", values);
  };
  return (
    <>
      <ModeIcon device={device} />
      <SummaryText>
        {joinParts([
          getPlacementText(),
          summary.ownPhonePosition && t("workspace.creatives.editor.summary_own_phone_position"),
        ])}
      </SummaryText>
    </>
  );
};

export const CustomCssSummary = ({ summary }: Readonly<{ summary: TCustomCssSummary }>) => {
  const { t } = useTranslation();
  if (summary.kind === "off") return <SummaryText>{t("common.off")}</SummaryText>;
  if (summary.kind === "empty")
    return <SummaryText>{t("workspace.creatives.editor.summary_css_empty")}</SummaryText>;
  return (
    <SummaryText>
      {joinParts([
        summary.light > 0 && t("workspace.creatives.editor.summary_css_lines", { count: summary.light }),
        summary.dark > 0 && t("workspace.creatives.editor.summary_css_dark_lines", { count: summary.dark }),
      ])}
    </SummaryText>
  );
};

export const ShowWhenSummary = ({
  conditionCount,
  displayPercentage,
}: Readonly<{ conditionCount: number; displayPercentage: number | null }>) => {
  const { t } = useTranslation();
  return (
    <SummaryText>
      {joinParts([
        conditionCount === 0
          ? t("workspace.creatives.editor.summary_everywhere")
          : t("workspace.creatives.editor.summary_conditions", { count: conditionCount }),
        displayPercentage !== null &&
          t("workspace.creatives.editor.summary_share", { percentage: displayPercentage }),
      ])}
    </SummaryText>
  );
};

export const ScheduleSummary = ({ schedule }: Readonly<{ schedule: TCreativeEditorForm["schedule"] }>) => {
  const { t, i18n } = useTranslation();
  const locale = getUiLocale(i18n);
  const timeZone = useEditorTimeZone();
  const [now] = useState(() => new Date());
  // Like the picker: a time is only written out once the browser's zone has taken over from the server's.
  const formatEnd = (date: Date | null, placeholder: string) => {
    if (!date) return placeholder;
    return timeZone ? formatDateTimeForDisplay(date, locale, getScheduleSummaryFormat(date, now)) : "";
  };
  return (
    <SummaryText>
      {t("workspace.creatives.editor.summary_schedule", {
        start: formatEnd(schedule.startAt, t("workspace.creatives.editor.starts_placeholder")),
        end: formatEnd(schedule.endAt, t("workspace.creatives.editor.ends_placeholder")),
      })}
    </SummaryText>
  );
};
