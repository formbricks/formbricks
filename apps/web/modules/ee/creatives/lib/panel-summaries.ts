import type { TCreativeStyle } from "@formbricks/creatives";
import type { TCustomCssInput } from "@formbricks/types/custom-css";
import type { TShowConditions } from "@formbricks/types/show-conditions";
import { isShowConditionGroup } from "@formbricks/types/show-conditions-evaluate";
import type { TStylingAppearance } from "@/lib/styling/dark-mode";
import { toCustomCssDraft } from "@/modules/custom-css/components/lib/draft";
import type { TCreativeColorKey } from "./creative";
import {
  type TBannerPlacement,
  type TCreativeDevice,
  type TCreativeStylingForm,
  type TFeedbackButtonPlacement,
  getDevicePlacement,
  getOwnColor,
} from "./styling-form";

/*
 * What a folded editor panel says about its values (`EditorPanel`'s `fold.summary`). Each one describes
 * what the preview draws, so it follows the appearance and device being edited. The components turn
 * these into literal `t()` keys, which the i18n scanner needs.
 */

const COLOR_KEYS: readonly TCreativeColorKey[] = ["backgroundColor", "textColor", "borderColor"];

export type TColorsSummary =
  | { kind: "lookAndFeel" }
  | { kind: "colors"; background: string; text: string; border: string | null; ownCount: number };

export const getColorsSummary = (
  styling: TCreativeStylingForm,
  style: TCreativeStyle,
  appearance: TStylingAppearance
): TColorsSummary => {
  if (!styling.theme.customStyles) return { kind: "lookAndFeel" };
  const { backgroundColor, textColor, borderColor } = style.element[appearance];
  return {
    kind: "colors",
    background: backgroundColor,
    text: textColor,
    border: borderColor,
    ownCount: COLOR_KEYS.filter((key) => getOwnColor(styling.theme, key, appearance) !== null).length,
  };
};

export type TShapeSummary =
  | { kind: "lookAndFeel" }
  | { kind: "shape"; pageFont: boolean; fontSize: number; borderRadius: number | null };

export const getShapeSummary = (
  styling: TCreativeStylingForm,
  style: TCreativeStyle,
  device: TCreativeDevice
): TShapeSummary =>
  styling.theme.customStyles
    ? {
        kind: "shape",
        pageFont: style.pageFont,
        fontSize: style.element[device].fontSize,
        // A banner's bar has no corner radius to set.
        borderRadius: styling.type === "feedbackButton" ? style.element.borderRadius : null,
      }
    : { kind: "lookAndFeel" };

export type TPositionSummary =
  | {
      kind: "feedbackButton";
      edge: TFeedbackButtonPlacement["edge"];
      offset: number;
      ownPhonePosition: boolean;
    }
  | {
      kind: "banner";
      edge: TBannerPlacement["placement"];
      layout: TBannerPlacement["layout"];
      ownPhonePosition: boolean;
    };

/** Position applies whether or not custom styles are on, so it never reads "Appearance". */
export const getPositionSummary = (
  styling: TCreativeStylingForm,
  device: TCreativeDevice
): TPositionSummary => {
  // On phone the summary already shows the phone's own placement; on desktop it would stay hidden.
  const ownPhonePosition = device === "desktop" && styling.position.phone !== null;
  if (styling.type === "feedbackButton") {
    const { edge, offset } = getDevicePlacement(styling.position, device);
    return { kind: "feedbackButton", edge, offset, ownPhonePosition };
  }
  const { placement, layout } = getDevicePlacement(styling.position, device);
  return { kind: "banner", edge: placement, layout, ownPhonePosition };
};

export type TCustomCssSummary =
  | { kind: "off" }
  | { kind: "empty" }
  | { kind: "lines"; light: number; dark: number };

const countLines = (css: string): number => css.split("\n").filter((line) => line.trim() !== "").length;

export const getCustomCssSummary = (
  source: TCustomCssInput | null | undefined,
  customStyles: boolean
): TCustomCssSummary => {
  if (!customStyles) return { kind: "off" };
  const draft = toCustomCssDraft(source);
  const light = countLines(draft.light);
  const dark = countLines(draft.dark);
  return light === 0 && dark === 0 ? { kind: "empty" } : { kind: "lines", light, dark };
};

/** The Show when conditions an author wrote, counted through nested groups. */
export const countShowConditions = (conditions: TShowConditions): number =>
  conditions === null
    ? 0
    : conditions.conditions.reduce(
        (count, item) => count + (isShowConditionGroup(item) ? countShowConditions(item) : 1),
        0
      );

const SCHEDULE_SUMMARY_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/** The Schedule picker's format, without the year when it is the current one, so the header stays short. */
export const getScheduleSummaryFormat = (date: Date, now: Date): Intl.DateTimeFormatOptions =>
  date.getFullYear() === now.getFullYear()
    ? SCHEDULE_SUMMARY_FORMAT
    : { ...SCHEDULE_SUMMARY_FORMAT, year: "numeric" };
