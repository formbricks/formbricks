"use client";

import { useTranslation } from "react-i18next";
import { TConditionGroup, TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
import { toSentenceFieldGroups } from "@/modules/survey/editor/lib/condition-field-groups";
import { createSharedConditionsFactory } from "@/modules/survey/editor/lib/shared-conditions-factory";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import type {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
} from "@/modules/ui/components/conditions-editor/types";

interface LogicEditorConditionsProps {
  readonly conditions: TConditionGroup;
  readonly localSurvey: TSurvey;
  /**
   * Where the rule runs: the index of the block it follows. Conditions may use that block and the
   * ones before it. `-1` is before the first question (start logic, ENG-6932): no answers yet.
   */
  readonly scopeBlockIdx: number;
  readonly getDefaultOperator: () => TSurveyLogicConditionsOperator;
  readonly onConditionsChange: (updater: (conditions: TConditionGroup) => TConditionGroup) => void;
  readonly depth?: number;
}

export function LogicEditorConditions({
  conditions,
  localSurvey,
  scopeBlockIdx,
  getDefaultOperator,
  onConditionsChange,
  depth = 0,
}: LogicEditorConditionsProps) {
  const { t } = useTranslation();

  const { config, callbacks } = createSharedConditionsFactory(
    {
      survey: localSurvey,
      t,
      blockIdx: scopeBlockIdx,
      getDefaultOperator,
      includeCreateGroup: true,
      // Block logic runs in the renderer, which projects the client-available reserved values.
      includeReservedFields: true,
    },
    { onConditionsChange }
  );

  // The rule sentence's grouping of the first selector (ENG-6969 T6): Questions, Hidden fields,
  // Embedded Data, Survey info. Quotas keep the shared grouping.
  const sentenceConfig: TConditionsEditorConfig = {
    ...(config as TConditionsEditorConfig),
    getLeftOperandOptions: () => toSentenceFieldGroups(config.getLeftOperandOptions(), t),
  };

  return (
    <ConditionsEditor
      variant="sentence"
      conditions={conditions}
      config={sentenceConfig}
      callbacks={callbacks as TConditionsEditorCallbacks}
      depth={depth}
    />
  );
}
