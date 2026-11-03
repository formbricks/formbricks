"use client";

import { EyeIcon, TrashIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup, TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { describeConditionGroup } from "@/modules/survey/editor/lib/flow-outline-text";
import {
  type TShowIfTarget,
  getShowIf,
  getShowIfScope,
  updateShowIf,
} from "@/modules/survey/editor/lib/show-if-editing";
import { getDefaultOperatorForElement } from "@/modules/survey/editor/lib/utils";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

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
  const { t } = useTranslation();
  const showIf = getShowIf(localSurvey, target);
  if (!showIf) return null;

  const summary = describeConditionGroup(showIf, localSurvey, t);

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="inline-flex">
          <Badge
            type="gray"
            size="tiny"
            icon={<EyeIcon />}
            text={t("workspace.surveys.edit.flow.show_if", { conditions: summary })}
            aria-label={t("workspace.surveys.edit.flow.edit_show_if", { conditions: summary })}
            onClick={() => onOpenChange(!isOpen)}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(44rem,calc(100vw-2rem))]"
        // The popover sits inside the block row in the React tree: keep its clicks off the row.
        onClick={(event) => event.stopPropagation()}>
        <ShowIfEditor
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          target={target}
          showIf={showIf}
          onClose={() => onOpenChange(false)}
        />
      </PopoverContent>
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

  // Pickers read recalled headlines as plain text, as in the rule editor.
  const scope = useMemo(() => {
    const scoped = getShowIfScope(localSurvey, target);
    return { ...scoped, survey: replaceHeadlineRecall(scoped.survey, "default") };
  }, [localSurvey, target]);

  const nearest = scope.survey.blocks.flatMap((block) => block.elements).at(-1);
  const getDefaultOperator = (): TSurveyLogicConditionsOperator =>
    nearest ? getDefaultOperatorForElement(nearest, t) : "isSet";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {isBlock
            ? t("workspace.surveys.edit.flow.show_block_only_if")
            : t("workspace.surveys.edit.flow.show_question_only_if")}
        </p>
        <p className="text-xs text-slate-500">
          {isBlock
            ? t("workspace.surveys.edit.flow.show_if_block_help")
            : t("workspace.surveys.edit.flow.show_if_question_help")}
        </p>
      </div>
      <div className="overflow-x-auto pb-1 text-sm">
        <LogicEditorConditions
          conditions={showIf}
          localSurvey={scope.survey}
          scopeBlockIdx={scope.blockIdx}
          getDefaultOperator={getDefaultOperator}
          onConditionsChange={(updater) => setLocalSurvey((survey) => updateShowIf(survey, target, updater))}
        />
      </div>
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
    </div>
  );
}
