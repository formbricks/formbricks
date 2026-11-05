"use client";

import { EyeIcon } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  OptionsShowIfCounts,
  OptionsShowIfPopover,
} from "@/modules/survey/editor/components/options-show-if-popover";
import { ShowIfPopover } from "@/modules/survey/editor/components/show-if-popover";
import {
  AddConditionCell,
  SHOW_IF_CELL_CLASS,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import { describeConditionGroup } from "@/modules/survey/editor/lib/flow-outline-text";
import {
  type TOptionsShowIfSection,
  type TShowIfSection,
  getBlockShowIfSection,
  getQuestionShowIfSections,
} from "@/modules/survey/editor/lib/questions-tab-show-if";
import type { TShowIfTarget } from "@/modules/survey/editor/lib/show-if-editing";
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
  readonly children: ReactNode;
}

const ShowIfSettingsSection = ({ title, help, children }: SectionProps) => (
  <div className="flex flex-col gap-1">
    <Label>{title}</Label>
    <p className="text-xs text-slate-500">{help}</p>
    <div className="mt-1 flex min-w-0">{children}</div>
  </div>
);

/** "Add condition", disabled, with why nothing can be added yet. */
const UnavailableAddCondition = ({ reason, label }: { readonly reason: string; readonly label: string }) => (
  <TooltipRenderer tooltipContent={reason} className="max-w-xs text-xs">
    <AddConditionCell disabled aria-label={label} className="cursor-not-allowed opacity-60" />
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
  const [isOpen, setIsOpen] = useState(false);
  const addLabel = `${title} ${t("workspace.surveys.edit.flow.add_show_if_condition")}`;

  if (section.state === "unavailable") {
    return <UnavailableAddCondition reason={unavailableReason} label={addLabel} />;
  }
  if (section.state === "set" && !section.editable) {
    return (
      <ReadOnlyCell>
        <EyeIcon aria-hidden="true" />
        <span className="truncate">
          {describeConditionGroup(section.conditions, localSurvey, t, {
            locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
          })}
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
      newTrigger={<AddConditionCell aria-label={addLabel} />}
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
          help={t("workspace.surveys.edit.flow.options_shown_if_help")}>
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
