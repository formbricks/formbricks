"use client";

import { CheckIcon, ClockIcon, EyeOffIcon, type LucideIcon, ScissorsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TEmbeddedDataSource } from "@formbricks/types/embedded-data";
import type { TReservedFieldPrivacy } from "@formbricks/types/embedded-data-resolver";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import type { TAutoCapturedAvailability } from "../lib/auto-captured-fields";
import { getAvailabilityLabel, getPrivacyLabel, getSourceIcon, getSourceLabel } from "./field-labels";

/**
 * The Embedded Data tables' status cells: a glyph and a tooltip where a sentence used to sit.
 *
 * Both tables answer the same two questions per row — can I use this now, and what happens to it
 * when responses are anonymized — and both used to answer them in prose wide enough to wrap. A
 * column of "After the response is submitted" is not scannable, and the heading above it already
 * says what the column is about, so the word moves into the tooltip and the cell keeps the glyph.
 *
 * **Every glyph is named twice on purpose.** `aria-label` gives a screen reader the same sentence a
 * pointer gets from the tooltip, because a tooltip alone is reachable by neither a screen reader nor
 * a touch device.
 */

/** A map rather than a ternary chain, so adding a privacy rule is a compile error here. */
const PRIVACY_ICONS: Record<TReservedFieldPrivacy, LucideIcon> = {
  keep: CheckIcon,
  drop: EyeOffIcon,
  redactQuery: ScissorsIcon,
};

/** Whether an auto-captured field can be referenced while the survey is running. */
export const FieldAvailabilityIcon = ({
  availability,
}: Readonly<{ availability: TAutoCapturedAvailability }>) => {
  const { t } = useTranslation();
  const label = getAvailabilityLabel(availability, t);
  const Icon = availability === "always" ? CheckIcon : ClockIcon;

  return (
    <TooltipRenderer tooltipContent={label}>
      <Icon className="size-4 text-slate-500" aria-label={label} />
    </TooltipRenderer>
  );
};

/** What the Anonymize responses toggle does to an auto-captured field. */
export const FieldPrivacyIcon = ({ privacy }: Readonly<{ privacy: TReservedFieldPrivacy }>) => {
  const { t } = useTranslation();
  const label = getPrivacyLabel(privacy, t);
  const Icon = PRIVACY_ICONS[privacy];

  return (
    <TooltipRenderer tooltipContent={label}>
      <Icon className="size-4 text-slate-500" aria-label={label} />
    </TooltipRenderer>
  );
};

/**
 * Where a declared field's value comes from.
 *
 * Two values, two distinct glyphs, and a word that is one of "Passed in" or "Calculated" — which is
 * short enough to read at a glance and specific enough that the glyph alone would be a guess. It is
 * plain text rather than the pill it used to be: the pill made a two-word phrase look like a status
 * badge, and every surface that shows a source now shows it the same way.
 */
export const FieldSourceIndicator = ({
  source,
  iconClassName = "size-4",
}: Readonly<{ source: TEmbeddedDataSource; iconClassName?: string }>) => {
  const { t } = useTranslation();

  return (
    // `whitespace-nowrap`: "Passed in" is two words, and wrapping it mid-phrase in a narrow column
    // reads as two separate values.
    <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-500">
      {getSourceIcon(source, `${iconClassName} shrink-0`)}
      {getSourceLabel(source, t)}
    </span>
  );
};
