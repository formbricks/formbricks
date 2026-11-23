"use client";

import { useParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowSendEmailActionConfig,
  type TWorkflowSurveyLink,
  WORKFLOW_SURVEY_LINK_TOKEN,
} from "@formbricks/workflows";
import { WorkflowEmailSurveyLinkChip } from "@/modules/ee/workflows/components/inspector/workflow-email-survey-link-chip";
import { WorkflowEmailSurveyLinkPopover } from "@/modules/ee/workflows/components/inspector/workflow-email-survey-link-popover";
import { useWorkflowSurveyOptions } from "@/modules/ee/workflows/hooks/use-trigger-survey-picker";
import { hasSurveyLinkToken, withoutSurveyLink } from "@/modules/ee/workflows/lib/email-survey-link";
import type { TWorkflowVariableGroup } from "@/modules/ee/workflows/lib/variable-picker";
import type { TEditorToolbarActions } from "@/modules/ui/components/editor/components/editor";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";
import type { TEditorTokenChip } from "@/modules/ui/components/editor/lib/token-chips";

interface UseWorkflowEmailSurveyLinkInput {
  config: TWorkflowSendEmailActionConfig;
  isEditable: boolean;
  /** Stores the link (Edit, or Insert before the chip lands in the body). */
  onChangeSurveyLink: (surveyLink: TWorkflowSurveyLink) => void;
  /** Rewrites the body from outside the editor (Remove), re-seeding it. */
  onReplaceBody: (next: Pick<TWorkflowSendEmailActionConfig, "surveyLink" | "body">) => void;
  recallSource: TEditorRecallSource;
  variableGroups: readonly TWorkflowVariableGroup[];
}

/**
 * The Send email message's survey link, for the body `Editor`: the toolbar's "Survey link" button
 * with its popover (`renderToolbarExtras`) and the chip that names the survey (`renderTokenChip`).
 */
export const useWorkflowEmailSurveyLink = ({
  config,
  isEditable,
  onChangeSurveyLink,
  onReplaceBody,
  recallSource,
  variableGroups,
}: UseWorkflowEmailSurveyLinkInput): {
  renderToolbarExtras: (actions: TEditorToolbarActions) => ReactNode;
  renderTokenChip: (chip: TEditorTokenChip) => ReactNode;
} => {
  const { t } = useTranslation();
  const params = useParams<{ workspaceId: string }>();
  const surveyOptions = useWorkflowSurveyOptions(params?.workspaceId ?? "");
  const linkSurveys = useMemo(
    () => surveyOptions.options.filter((survey) => survey.type === "link"),
    [surveyOptions.options]
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { surveyLink } = config;
  const isLinkInBody = hasSurveyLinkToken(config.body);
  const variableOptions = useMemo(() => variableGroups.flatMap((group) => group.options), [variableGroups]);

  const remove = useCallback(() => {
    setIsPopoverOpen(false);
    onReplaceBody(withoutSurveyLink(config));
  }, [config, onReplaceBody]);

  const renderToolbarExtras = (actions: TEditorToolbarActions) => (
    <WorkflowEmailSurveyLinkPopover
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
      surveyLink={surveyLink}
      isLinkInBody={isLinkInBody}
      linkSurveys={linkSurveys}
      disabled={!isEditable}
      recallSource={recallSource}
      variableOptions={variableOptions}
      onSave={(next) => {
        setIsPopoverOpen(false);
        onChangeSurveyLink(next);
        // One link per email: Save on an existing chip only changes what it links to.
        if (!isLinkInBody) actions.insertText(WORKFLOW_SURVEY_LINK_TOKEN);
      }}
      onRemove={remove}
    />
  );

  const surveyName = linkSurveys.find((survey) => survey.id === surveyLink?.surveyId)?.name;
  const passedKeys =
    surveyLink?.embeddedData
      .filter((row) => row.value.trim() !== "")
      .map((row) => row.key)
      .join(", ") ?? "";
  const description = passedKeys
    ? t("workspace.workflows.email_survey_link_chip_passes", { fields: passedKeys })
    : t("workspace.workflows.email_survey_link_chip_help");
  const renderTokenChip = useCallback(
    (chip: TEditorTokenChip) =>
      chip.token === WORKFLOW_SURVEY_LINK_TOKEN ? (
        <WorkflowEmailSurveyLinkChip
          label={surveyName ?? chip.label}
          description={description}
          isEditable={isEditable}
          onEdit={() => setIsPopoverOpen(true)}
          onRemove={remove}
        />
      ) : null,
    [surveyName, description, isEditable, remove]
  );

  return { renderToolbarExtras, renderTokenChip };
};
