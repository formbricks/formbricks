"use client";

import type { TFunction } from "i18next";
import { EyeIcon, TrashIcon } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  SHOW_IF_CELL_CLASS,
  ShowIfConditionsEditor,
  ShowIfPopoverFrame,
  useShowIfScope,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import { describeConditionGroup } from "@/modules/survey/editor/lib/flow-outline-text";
import {
  type TShowIfTarget,
  createDraftShowIf,
  getShowIf,
  isShowIfComplete,
  updateShowIf,
} from "@/modules/survey/editor/lib/show-if-editing";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverTrigger } from "@/modules/ui/components/popover";

interface ShowIfPopoverProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly target: TShowIfTarget;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * What opens a new show-if when the target has none yet: the faint "Show block if…" hint, or a
   * question's "Add condition" cell. Without it, a target with no show-if renders nothing.
   */
  readonly newTrigger?: ReactNode;
  /**
   * A block's chip reads only its condition, for a place whose heading already says "Show block if…"
   * (the block's Settings tab on the Questions tab, ENG-6949).
   */
  readonly summaryOnly?: boolean;
}

/** A block's show-if chip on its header: "Show block if …". */
export const getBlockShowIfChipText = (conditions: string, t: TFunction): string =>
  t("workspace.surveys.edit.flow.show_block_if_chip", { conditions });

/**
 * The show-if of a block or a question on the Flow tab (ENG-6931): a block's "Show block if …" chip on
 * its header, or a question's condition in its "Show question if…" cell (ENG-6969 T10), or what opens
 * a new one when it has none; and the popover that edits its conditions with the logic editor's
 * conditions editor. The editor offers only what the reference rule allows (`getShowIfScope`).
 *
 * The popover edits a draft: only Done writes it to the survey, so opening one to look, then Escape,
 * a click outside or Cancel, changes nothing (ENG-6969 T1).
 */
export function ShowIfPopover({
  localSurvey,
  setLocalSurvey,
  target,
  isOpen,
  onOpenChange,
  newTrigger,
  summaryOnly = false,
}: ShowIfPopoverProps) {
  const { t, i18n } = useTranslation();
  const showIf = getShowIf(localSurvey, target);
  if (!showIf && !newTrigger) return null;

  const summary = showIf
    ? describeConditionGroup(showIf, localSurvey, t, {
        locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
      })
    : "";
  const isBlock = target.type === "block";

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {showIf ? (
          <button
            type="button"
            className={
              isBlock
                ? "inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
                : SHOW_IF_CELL_CLASS.set
            }
            aria-label={t("workspace.surveys.edit.flow.edit_show_if", { conditions: summary })}
            // The block header's chip sits inside the row's toggle: don't collapse the block.
            onClick={(event) => event.stopPropagation()}>
            <EyeIcon className="size-3 shrink-0" aria-hidden="true" />
            {/* The question's column header already says "Show question if…". */}
            <span className="truncate">
              {isBlock && !summaryOnly ? getBlockShowIfChipText(summary, t) : summary}
            </span>
          </button>
        ) : (
          newTrigger
        )}
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
  /** The saved show-if; absent for a new one. */
  readonly showIf: TConditionGroup | undefined;
  readonly onClose: () => void;
}

/**
 * The popover's content, mounted only while it is open, so each opening starts a fresh draft: a copy
 * of the saved show-if, or a new one whose first field is still to be chosen (ENG-6969 T6).
 */
function ShowIfEditor({ localSurvey, setLocalSurvey, target, showIf, onClose }: ShowIfEditorProps) {
  const { t } = useTranslation();
  const isBlock = target.type === "block";
  const isNew = showIf === undefined;
  const { scope, getDefaultOperator } = useShowIfScope(localSurvey, target);
  const [draft, setDraft] = useState<TConditionGroup>(() =>
    showIf ? structuredClone(showIf) : createDraftShowIf()
  );

  const save = (next: TConditionGroup | undefined) => {
    setLocalSurvey((survey) => updateShowIf(survey, target, () => next));
    onClose();
  };

  const changeConditions = (updater: (conditions: TConditionGroup) => TConditionGroup) => {
    const next = updater(structuredClone(draft));
    if (next.conditions.length > 0) {
      setDraft(next);
      return;
    }
    // Removing the last condition removes the show-if, as Remove does; on a new one there is nothing
    // to remove, so it is simply dropped.
    if (isNew) onClose();
    else save(undefined);
  };

  return (
    <ShowIfPopoverFrame
      // The popover is named like the chip or hint that opens it (ENG-6969 T9).
      title={
        isBlock
          ? t("workspace.surveys.edit.flow.show_block_if")
          : t("workspace.surveys.edit.flow.show_question_if")
      }
      help={
        isBlock
          ? t("workspace.surveys.edit.flow.show_if_block_help")
          : t("workspace.surveys.edit.flow.show_if_question_help")
      }
      footer={
        <div className="flex justify-between gap-2">
          {isNew ? (
            <Button type="button" size="sm" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => save(undefined)}>
              <TrashIcon />
              {t("workspace.surveys.edit.flow.remove_condition")}
            </Button>
          )}
          <Button type="button" size="sm" disabled={!isShowIfComplete(draft)} onClick={() => save(draft)}>
            {t("common.done")}
          </Button>
        </div>
      }>
      <ShowIfConditionsEditor
        conditions={draft}
        scope={scope}
        getDefaultOperator={getDefaultOperator}
        onConditionsChange={changeConditions}
      />
    </ShowIfPopoverFrame>
  );
}
