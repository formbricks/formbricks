"use client";

import { CheckIcon, ClockIcon, EyeOffIcon, type LucideIcon, ScissorsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TEmbeddedDataSource } from "@formbricks/types/embedded-data";
import type { TReservedFieldPrivacy } from "@formbricks/types/embedded-data-resolver";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import type { TAutoCapturedAvailability } from "../lib/auto-captured-fields";
import { SOURCE_ICONS, getAvailabilityLabel, getPrivacyLabel, getSourceLabel } from "../lib/field-labels";

/**
 * The Embedded Data tables' status cells: a glyph and a tooltip where a sentence used to sit.
 *
 * Both tables answer the same questions per row — what kind of value is this, where does it come
 * from, can I use it now, and what happens to it when responses are anonymized — and they used to
 * answer them in prose wide enough to wrap. A column of "After the response is submitted" is not
 * scannable, and the heading above it already says what the column is about, so the words move into
 * the tooltip and the cell keeps the glyph.
 *
 * **Every glyph is a focusable, named control.** Its trigger carries the sentence as `aria-label`, so
 * a screen reader hears it and the keyboard reaches it whether or not the tooltip is open; the tooltip
 * repeats the same sentence for a pointer, and the SVG inside is decoration.
 */

/**
 * One glyph that explains itself on hover or focus.
 *
 * The padded, tinted hover box is the whole point: an icon that silently grows a tooltip reads as
 * decoration until someone happens to rest on it, and a target the size of the glyph is a hard one
 * to rest on. `-m-1` keeps the box from moving the row it sits in.
 *
 * Composed from the tooltip primitives rather than `TooltipRenderer`, whose trigger is a plain
 * `<span>` the keyboard cannot reach. A `<button>` takes focus, and Radix opens the tooltip on focus,
 * so Tab lands on the glyph and shows its sentence. The name sits on the button and not on the SVG:
 * Radix links the tooltip as a description only while it is open, and a closed glyph would otherwise
 * have no name at all. The button does nothing of its own on click, so in a clickable row the click
 * still reaches the row, like the rest of the cell.
 */
export const StatusIcon = ({
  icon: Icon,
  label,
  iconClassName = "size-4",
}: Readonly<{ icon: LucideIcon; label: string; iconClassName?: string }>) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="-m-1 inline-flex w-fit items-center justify-center rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden">
          <Icon className={`${iconClassName} shrink-0`} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

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

  return (
    <StatusIcon
      icon={availability === "always" ? CheckIcon : ClockIcon}
      label={getAvailabilityLabel(availability, t)}
    />
  );
};

/** What the Anonymize responses toggle does to an auto-captured field. */
export const FieldPrivacyIcon = ({ privacy }: Readonly<{ privacy: TReservedFieldPrivacy }>) => {
  const { t } = useTranslation();

  return <StatusIcon icon={PRIVACY_ICONS[privacy]} label={getPrivacyLabel(privacy, t)} />;
};

/**
 * Where a declared field's value comes from, with its word: for a row that has no column heading to
 * carry it — the editor's field rows, the library picker, and the read-only source block in both edit
 * dialogs. A table's Source column draws the glyph alone through {@link StatusIcon}, since its heading
 * already says what the column answers.
 */
export const FieldSourceIndicator = ({
  source,
  iconClassName = "size-4",
}: Readonly<{ source: TEmbeddedDataSource; iconClassName?: string }>) => {
  const { t } = useTranslation();
  const Icon = SOURCE_ICONS[source];

  return (
    // `whitespace-nowrap`: "Passed in" is two words, and wrapping it mid-phrase reads as two values.
    <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-500">
      <Icon className={`${iconClassName} shrink-0`} aria-hidden="true" />
      {getSourceLabel(source, t)}
    </span>
  );
};
