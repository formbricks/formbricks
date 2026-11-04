"use client";

import { EyeIcon, TrashIcon } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  ShowIfConditionsEditor,
  ShowIfPopoverFrame,
  useShowIfScope,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import { describeConditionGroup } from "@/modules/survey/editor/lib/flow-outline-text";
import { type TShowIfTarget, getShowIf, updateShowIf } from "@/modules/survey/editor/lib/show-if-editing";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverTrigger } from "@/modules/ui/components/popover";

interface ShowIfPopoverProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly target: TShowIfTarget;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * The "Show if" badge of a block or a question on the Flow tab (ENG-6931), and the popover that edits
 * its conditions with the logic editor's conditions editor. The editor offers only what the
 * reference rule allows (`getShowIfScope`); removing the last condition removes the show-if.
 */
export function ShowIfPopover({
  localSurvey,
  setLocalSurvey,
  target,
  isOpen,
  onOpenChange,
}: ShowIfPopoverProps) {
  const { t, i18n } = useTranslation();
  const showIf = getShowIf(localSurvey, target);
  if (!showIf) return null;

  const summary = describeConditionGroup(showIf, localSurvey, t, {
    locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
  });

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-full focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
          aria-label={t("workspace.surveys.edit.flow.edit_show_if", { conditions: summary })}
          // The block header's badge sits inside the row's toggle: don't collapse the block.
          onClick={(event) => event.stopPropagation()}>
          <Badge
            type="gray"
            size="tiny"
            icon={<EyeIcon />}
            text={t("workspace.surveys.edit.flow.show_if", { conditions: summary })}
          />
        </button>
      </PopoverTrigger>
      {/* Mounted only while open: its scope is computed for the open popover alone. */}
      {isOpen && (
        <ShowIfEditor
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          target={target}
          showIf={showIf}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Popover>
  );
}

interface ShowIfEditorProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly target: TShowIfTarget;
  readonly showIf: TConditionGroup;
  readonly onClose: () => void;
}

/** The popover's content, mounted only while it is open. */
function ShowIfEditor({ localSurvey, setLocalSurvey, target, showIf, onClose }: ShowIfEditorProps) {
  const { t } = useTranslation();
  const isBlock = target.type === "block";
  const { scope, getDefaultOperator } = useShowIfScope(localSurvey, target);

  return (
    <ShowIfPopoverFrame
      title={
        isBlock
          ? t("workspace.surveys.edit.flow.show_block_only_if")
          : t("workspace.surveys.edit.flow.show_question_only_if")
      }
      help={
        isBlock
          ? t("workspace.surveys.edit.flow.show_if_block_help")
          : t("workspace.surveys.edit.flow.show_if_question_help")
      }
      footer={
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setLocalSurvey((survey) => updateShowIf(survey, target, () => undefined));
              onClose();
            }}>
            <TrashIcon />
            {t("workspace.surveys.edit.flow.remove_show_if")}
          </Button>
          <Button type="button" size="sm" onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      }>
      <ShowIfConditionsEditor
        conditions={showIf}
        scope={scope}
        getDefaultOperator={getDefaultOperator}
        onConditionsChange={(updater) => setLocalSurvey((survey) => updateShowIf(survey, target, updater))}
      />
    </ShowIfPopoverFrame>
  );
}
