"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import { RestrictedVisibilityMarker } from "@/modules/survey/visibility/components/restricted-visibility-marker";
import {
  MakeVisibleToWorkspaceButton,
  RoleAccessMarker,
} from "@/modules/survey/visibility/components/role-access-marker";
import { WorkspaceVisibilityMarker } from "@/modules/survey/visibility/components/workspace-visibility-marker";
import { getRestrictedAuthor, getVisibilityErrorReaction } from "@/modules/survey/visibility/lib/collaborate";
import { type TRowVisibilityMarker, getRowVisibilityMarker } from "@/modules/survey/visibility/lib/markers";
import { type TSurveyVisibilityUiGate, showVisibilityControls } from "@/modules/survey/visibility/lib/state";

type MakeVisibleStripProps = {
  surveyId: string;
  workspaceName: string;
  updateSurveyVisibility: (surveyId: string, visibility: TSurveyVisibility) => Promise<void>;
  onVisibilityNotEnabled: () => void;
};

/** The author-gone row's one-click way out, in a strip under the row so its columns stay aligned. */
export const MakeVisibleStrip = ({
  surveyId,
  workspaceName,
  updateSurveyVisibility,
  onVisibilityNotEnabled,
}: Readonly<MakeVisibleStripProps>) => {
  const { t } = useTranslation();
  const [isMakingVisible, setIsMakingVisible] = useState(false);

  const handleMakeVisible = async () => {
    setIsMakingVisible(true);
    try {
      await updateSurveyVisibility(surveyId, "workspace");
      toast.success(t("workspace.surveys.visibility.visibility_updated"));
    } catch (error) {
      const reaction = getVisibilityErrorReaction(error);
      if (reaction === "pending") {
        toast.success(t("workspace.surveys.visibility.visibility_update_pending"));
      } else {
        toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
        if (reaction === "hide_controls") onVisibilityNotEnabled();
      }
    } finally {
      setIsMakingVisible(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-3 bg-amber-50 px-4 py-2">
      <p className="text-sm text-amber-800">{t("workspace.surveys.visibility.author_gone_notice")}</p>
      <MakeVisibleToWorkspaceButton
        workspaceName={workspaceName}
        loading={isMakingVisible}
        onClick={() => void handleMakeVisible()}
      />
    </div>
  );
};

/** All of a row's visibility information sits here, next to the name: the marker before it, any detail after. */
export const SurveyNameCell = ({
  name,
  marker,
  workspaceName,
  author,
}: Readonly<{
  name: string;
  marker: TRowVisibilityMarker | null;
  workspaceName: string;
  author: ReturnType<typeof getRestrictedAuthor>;
}>) => {
  if (!marker) return <div className="w-full truncate">{name}</div>;
  // Shrinks to the name, so a detail marker sits right after it rather than at the column's end.
  const nameNode = <div className="min-w-0 truncate">{name}</div>;
  if (marker.kind === "workspace") {
    return <WorkspaceVisibilityMarker workspaceName={workspaceName}>{nameNode}</WorkspaceVisibilityMarker>;
  }
  return (
    <>
      <RestrictedVisibilityMarker author={author}>{nameNode}</RestrictedVisibilityMarker>
      {marker.detail && <RoleAccessMarker kind={marker.detail} workspaceName={workspaceName} />}
    </>
  );
};

export type TSurveyRowState = {
  isArchived: boolean;
  isScheduled: boolean;
  visibilityMarker: TRowVisibilityMarker | null;
  isAuthorGone: boolean;
  canMakeVisible: boolean;
  /** Where clicking the row goes; null when the row is not clickable. */
  href: string | null;
  isDropdownDisabled: boolean;
};

/** Everything a survey row decides from the survey and the viewer, kept in one place for every cell. */
export const getSurveyRowState = ({
  survey,
  isReadOnly,
  surveyVisibilityGate,
  workspaceBasePath,
}: {
  survey: TSurveyListItem;
  isReadOnly: boolean;
  surveyVisibilityGate: TSurveyVisibilityUiGate;
  workspaceBasePath: string;
}): TSurveyRowState => {
  const isArchived = survey.archivedAt !== null;
  const isScheduled = !isArchived && survey.status === "paused" && survey.publishOn !== null;
  const visibilityMarker = getRowVisibilityMarker({
    enforced: surveyVisibilityGate.enforced,
    visibility: survey.visibility,
    access: survey.access,
    owner: survey.owner,
  });
  const isAuthorGone = visibilityMarker?.kind === "restricted" && visibilityMarker.detail === "author_gone";
  const canMakeVisible = isAuthorGone && showVisibilityControls(surveyVisibilityGate, survey.access);

  // A read-only draft, or an archived draft (which has no summary), is not clickable. Archived surveys
  // are read-only, so they always open the summary, never the editor.
  const isNotClickable = survey.status === "draft" && (isReadOnly || isArchived);
  let href: string | null = null;
  if (!isNotClickable) {
    href =
      survey.status === "draft" && !isArchived
        ? `${workspaceBasePath}/surveys/${survey.id}/edit`
        : `${workspaceBasePath}/surveys/${survey.id}/summary`;
  }

  return {
    isArchived,
    isScheduled,
    visibilityMarker,
    isAuthorGone,
    canMakeVisible,
    href,
    // The menu stays enabled for archived surveys so they can be restored or deleted; only a read-only
    // draft (which has no available actions) disables it.
    isDropdownDisabled: survey.status === "draft" && isReadOnly,
  };
};
