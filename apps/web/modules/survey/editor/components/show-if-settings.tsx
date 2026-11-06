"use client";

import { EyeIcon } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  OptionsShowIfCounts,
  OptionsShowIfPopover,
} from "@/modules/survey/editor/components/options-show-if-popover";
import { FlowTextParts, useElementIcons } from "@/modules/survey/editor/components/reference-chip";
import { ShowIfPopover } from "@/modules/survey/editor/components/show-if-popover";
import {
  AddConditionButton,
  SHOW_IF_CELL_CLASS,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import { describeConditionGroupParts } from "@/modules/survey/editor/lib/flow-outline-text";
import {
  type TOptionsShowIfSection,
  type TShowIfSection,
  getBlockShowIfSection,
  getCardShowIf,
  getQuestionShowIfSections,
} from "@/modules/survey/editor/lib/questions-tab-show-if";
import { toPlainText } from "@/modules/survey/editor/lib/reference-chips";
import { SHOW_IF_ANCHOR_PROPS } from "@/modules/survey/editor/lib/show-if-anchor";
import type { TShowIfTarget } from "@/modules/survey/editor/lib/show-if-editing";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/**
 * Show-if on the Questions tab (ENG-6949): "Show block if…" on a block's Settings tab, "Show question
 * if…" and "Show options if…" on a question's. They open the Flow tab's popovers on the same data, so
 * a change on one tab shows on the other.
 */

interface SectionProps {
  readonly title: string;
  readonly help: string;
  /** The longer explanation behind an (i) next to the title, and that (i)'s accessible name. */
  readonly info?: { readonly label: string; readonly content: ReactNode };
  readonly children: ReactNode;
}

/**
 * A section's heading reads like the other settings on the card (Recode): the popover it opens leaves
 * its own heading out, and opens under the whole section (`SHOW_IF_ANCHOR_PROPS`).
 */
const ShowIfSettingsSection = ({ title, help, info, children }: SectionProps) => (
  <div className="flex flex-col gap-1" {...SHOW_IF_ANCHOR_PROPS}>
    <div className="flex items-center gap-1.5">
      <Label>{title}</Label>
      {info && <InfoTooltip label={info.label}>{info.content}</InfoTooltip>}
    </div>
    <p className="text-sm text-slate-500">{help}</p>
    <div className="mt-2 flex min-w-0">{children}</div>
  </div>
);

/** "Add condition", disabled, with why nothing can be added yet. */
const UnavailableAddCondition = ({ reason, label }: { readonly reason: string; readonly label: string }) => (
  <TooltipRenderer tooltipContent={reason} className="max-w-xs text-xs">
    {/* A disabled button gets no pointer events: the span keeps the tooltip working. */}
    <span className="inline-flex cursor-not-allowed">
      <AddConditionButton disabled aria-label={label} />
    </span>
  </TooltipRenderer>
);

const ReadOnlyCell = ({ children }: { readonly children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <TooltipRenderer tooltipContent={t("workspace.surveys.edit.show_if_read_only_hint")} className="text-xs">
      <span className={SHOW_IF_CELL_CLASS.readOnly}>{children}</span>
    </TooltipRenderer>
  );
};

interface ShowIfFieldProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly target: Exclude<TShowIfTarget, { type: "option" }>;
  readonly section: TShowIfSection;
  /** The section's title, which also names its "Add condition" button. */
  readonly title: string;
  readonly unavailableReason: string;
}

/** A block's or a question's show-if: its condition, "Add condition", or why none can be added. */
const ShowIfField = ({
  localSurvey,
  setLocalSurvey,
  target,
  section,
  title,
  unavailableReason,
}: ShowIfFieldProps) => {
  const { t, i18n } = useTranslation();
  const elementIcons = useElementIcons();
  const [isOpen, setIsOpen] = useState(false);
  const addLabel = `${title} ${t("workspace.surveys.edit.flow.add_show_if_condition")}`;

  if (section.state === "unavailable") {
    return <UnavailableAddCondition reason={unavailableReason} label={addLabel} />;
  }
  if (section.state === "set" && !section.editable) {
    return (
      <ReadOnlyCell>
        <EyeIcon aria-hidden="true" />
        <span className="flex min-w-0 items-center gap-1">
          {/* References as chips (ENG-6969 T3), as on the Flow tab. */}
          <FlowTextParts
            centered
            parts={describeConditionGroupParts(section.conditions, localSurvey, t, {
              locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
            })}
            elementIcons={elementIcons}
          />
        </span>
      </ReadOnlyCell>
    );
  }
  return (
    <ShowIfPopover
      localSurvey={localSurvey}
      setLocalSurvey={setLocalSurvey}
      target={target}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      summaryOnly
      hideHeading
      newTrigger={<AddConditionButton aria-label={addLabel} />}
    />
  );
};

interface BlockShowIfSettingsProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly blockIdx: number;
}

/** "Show block if…" on a block's Settings tab. */
export const BlockShowIfSettings = ({ localSurvey, setLocalSurvey, blockIdx }: BlockShowIfSettingsProps) => {
  const { t } = useTranslation();
  const title = t("workspace.surveys.edit.flow.show_block_if");
  return (
    <ShowIfSettingsSection title={title} help={t("workspace.surveys.edit.flow.show_if_block_help")}>
      <ShowIfField
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        target={{ type: "block", blockIdx }}
        section={getBlockShowIfSection(localSurvey, blockIdx)}
        title={title}
        unavailableReason={t("workspace.surveys.edit.flow.show_block_if_nothing_before")}
      />
    </ShowIfSettingsSection>
  );
};

interface OptionsShowIfFieldProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly blockIdx: number;
  readonly elementIdx: number;
  readonly section: TOptionsShowIfSection;
}

/** A question's options' show-if: the Flow tab's counts or "Add condition", or why none can be added. */
const OptionsShowIfField = ({
  localSurvey,
  setLocalSurvey,
  blockIdx,
  elementIdx,
  section,
}: OptionsShowIfFieldProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (section.state === "unavailable") {
    return (
      <UnavailableAddCondition
        reason={t("workspace.surveys.edit.show_if_nothing_before_options")}
        label={`${t("workspace.surveys.edit.flow.show_options_if")} ${t("workspace.surveys.edit.flow.add_show_if_condition")}`}
      />
    );
  }
  if (section.state === "set" && !section.editable) {
    return (
      <ReadOnlyCell>
        <OptionsShowIfCounts showIfCount={section.showIfCount} hiddenCount={section.hiddenCount} />
      </ReadOnlyCell>
    );
  }
  return (
    <OptionsShowIfPopover
      localSurvey={localSurvey}
      setLocalSurvey={setLocalSurvey}
      blockIdx={blockIdx}
      elementIdx={elementIdx}
      optionLists={section.optionLists}
      showIfCount={section.state === "set" ? section.showIfCount : 0}
      hiddenCount={section.state === "set" ? section.hiddenCount : 0}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      hideHeading
      newTrigger={
        <AddConditionButton
          aria-label={`${t("workspace.surveys.edit.flow.show_options_if")} ${t("workspace.surveys.edit.flow.add_show_if_condition")}`}
        />
      }
    />
  );
};

interface QuestionShowIfSettingsProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly blockIdx: number;
  /** The question's index on its block. */
  readonly elementIdx: number;
}

/** "Show question if…", and "Show options if…" for a question with options, on its Settings tab. */
export const QuestionShowIfSettings = ({
  localSurvey,
  setLocalSurvey,
  blockIdx,
  elementIdx,
}: QuestionShowIfSettingsProps) => {
  const { t } = useTranslation();
  const sections = getQuestionShowIfSections(localSurvey, blockIdx, elementIdx);
  const title = t("workspace.surveys.edit.flow.show_question_if");

  return (
    <div className="flex flex-col gap-4">
      <ShowIfSettingsSection title={title} help={t("workspace.surveys.edit.flow.show_if_question_help")}>
        <ShowIfField
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          target={{ type: "element", blockIdx, elementIdx }}
          section={sections.question}
          title={title}
          unavailableReason={t("workspace.surveys.edit.show_if_nothing_before_question")}
        />
      </ShowIfSettingsSection>
      {sections.options && (
        <ShowIfSettingsSection
          title={t("workspace.surveys.edit.flow.show_options_if")}
          help={t("workspace.surveys.edit.flow.options_shown_if_help")}
          info={{
            label: t("workspace.surveys.edit.flow.options_shown_if_info_label"),
            content: t("workspace.surveys.edit.flow.options_shown_if_info"),
          }}>
          <OptionsShowIfField
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            blockIdx={blockIdx}
            elementIdx={elementIdx}
            section={sections.options}
          />
        </ShowIfSettingsSection>
      )}
    </div>
  );
};

interface ShowIfBadgeProps {
  readonly localSurvey: TSurvey;
  readonly target: Exclude<TShowIfTarget, { type: "option" }>;
}

/**
 * A block's or a question's show-if on its Questions-tab card, beside "1 question · code" or
 * "Optional · code" (review of ENG-6949): the Flow tab's eye chip, read-only, so a block or question
 * that can be hidden says so without opening its Settings tab. Nothing when it has none.
 */
export const ShowIfBadge = ({ localSurvey, target }: ShowIfBadgeProps) => {
  const { t, i18n } = useTranslation();
  const elementIcons = useElementIcons();
  const showIf = getCardShowIf(localSurvey, target);
  if (!showIf) return null;
  const parts = describeConditionGroupParts(showIf, localSurvey, t, {
    locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
  });
  const label =
    target.type === "block"
      ? t("workspace.surveys.edit.flow.show_block_if")
      : t("workspace.surveys.edit.flow.show_question_if");
  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600"
      title={`${label} ${toPlainText(parts)}`}>
      <EyeIcon className="size-3 shrink-0" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <FlowTextParts parts={parts} elementIcons={elementIcons} centered />
      </span>
    </span>
  );
};
