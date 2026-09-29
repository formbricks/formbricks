"use client";

import { ArchiveIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurveyStatus, TSurveyVisibility } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { cn } from "@/lib/cn";
import { timeSince } from "@/lib/time";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { SurveyTypeIndicator } from "@/modules/survey/list/components/survey-type-indicator";
import type { surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import {
  MakeVisibleToWorkspaceButton,
  RoleAccessMarker,
} from "@/modules/survey/visibility/components/role-access-marker";
import { WorkspaceVisibilityMarker } from "@/modules/survey/visibility/components/workspace-visibility-marker";
import { getVisibilityErrorReaction } from "@/modules/survey/visibility/lib/collaborate";
import { getRestrictedRowMarker, showWorkspaceMarker } from "@/modules/survey/visibility/lib/markers";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { SurveyDropDownMenu } from "./survey-dropdown-menu";

interface SurveyCardProps {
  survey: TSurveyListItem;
  publicDomain: string;
  isReadOnly: boolean;
  deleteSurvey: (surveyId: string) => Promise<void>;
  updateSurveyStatus: (surveyId: string, status: TSurveyStatus) => Promise<void>;
  archiveSurvey: (surveyId: string) => Promise<void>;
  restoreSurvey: (surveyId: string) => Promise<void>;
  renameSurvey: (surveyId: string, name: string) => Promise<void>;
  locale: TUserLocale;
  /** ENG-3395: the restricted-surveys gate. While it is off the row renders exactly as before. */
  surveyVisibilityEnabled: boolean;
  workspaceName: string;
  listQueryKey: ReturnType<typeof surveyKeys.list>;
  updateSurveyVisibility: (surveyId: string, visibility: TSurveyVisibility) => Promise<void>;
  onVisibilityNotEnabled: () => void;
}
export const SurveyCard = ({
  survey,
  publicDomain,
  isReadOnly,
  deleteSurvey,
  updateSurveyStatus,
  archiveSurvey,
  restoreSurvey,
  renameSurvey,
  locale,
  surveyVisibilityEnabled,
  workspaceName,
  listQueryKey,
  updateSurveyVisibility,
  onVisibilityNotEnabled,
}: Readonly<SurveyCardProps>) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const isArchived = survey.archivedAt !== null;
  const isScheduled = !isArchived && survey.status === "paused" && survey.publishOn !== null;
  const surveyStatusLabel = (() => {
    switch (survey.status) {
      case "inProgress":
        return t("common.in_progress");
      case "completed":
        return t("common.closed");
      case "draft":
        return t("common.draft");
      case "paused":
        return isScheduled ? t("common.scheduled") : t("common.paused");
      default:
        return undefined;
    }
  })();

  const isSurveyCreationDeletionDisabled = isReadOnly;

  const [isMakingVisible, setIsMakingVisible] = useState(false);
  const hasWorkspaceMarker = showWorkspaceMarker({
    gate: surveyVisibilityEnabled,
    visibility: survey.visibility,
  });
  const restrictedMarker = getRestrictedRowMarker({
    gate: surveyVisibilityEnabled,
    visibility: survey.visibility,
    access: survey.access,
    owner: survey.owner,
  });
  const canMakeVisible = restrictedMarker === "author_gone" && survey.access.canManageVisibility;

  const handleMakeVisible = async () => {
    setIsMakingVisible(true);
    try {
      await updateSurveyVisibility(survey.id, "workspace");
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

  const linkHref = useMemo(() => {
    // Archived surveys are read-only; always send to summary (never the editor).
    if (isArchived) {
      return `${workspaceBasePath}/surveys/${survey.id}/summary`;
    }
    return survey.status === "draft"
      ? `${workspaceBasePath}/surveys/${survey.id}/edit`
      : `${workspaceBasePath}/surveys/${survey.id}/summary`;
  }, [isArchived, survey.status, survey.id, workspaceBasePath]);

  // A read-only draft, or an archived draft (which has no summary), is not clickable.
  const isCardNotClickable = survey.status === "draft" && (isReadOnly || isArchived);

  // The dropdown must stay enabled for archived surveys so they can be restored or deleted; only a
  // read-only draft (which has no available actions) disables it.
  const isDropdownDisabled = survey.status === "draft" && isReadOnly;

  const CardBody = (
    <div
      className={cn(
        "grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-xs transition-colors ease-in-out",
        !isCardNotClickable && "hover:border-slate-400",
        restrictedMarker === "author_gone" && "bg-amber-50",
        canMakeVisible && "rounded-b-none border-b-0"
      )}>
      <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
        {hasWorkspaceMarker ? (
          <WorkspaceVisibilityMarker workspaceName={workspaceName}>
            <div className="w-full truncate">{survey.name}</div>
          </WorkspaceVisibilityMarker>
        ) : (
          <div className="w-full truncate">{survey.name}</div>
        )}
      </div>
      <div
        className={cn(
          "col-span-1 flex w-fit items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm whitespace-nowrap text-slate-800",
          isArchived && "bg-slate-100",
          !isArchived && survey.status === "inProgress" && "bg-emerald-50",
          !isArchived && survey.status === "completed" && "bg-slate-200",
          !isArchived && survey.status === "draft" && "bg-slate-100",
          !isArchived && survey.status === "paused" && "bg-slate-100"
        )}>
        {isArchived ? (
          <>
            <div className="rounded-full bg-slate-300 p-1">
              <ArchiveIcon className="size-3 text-slate-600" />
            </div>{" "}
            {t("common.archived")}
          </>
        ) : (
          <>
            <SurveyStatusIndicator status={survey.status} isScheduled={isScheduled} />{" "}
            {surveyStatusLabel}{" "}
          </>
        )}
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
        {survey.completedResponseCount}
      </div>
      <div className="col-span-1 flex justify-between">
        <SurveyTypeIndicator type={survey.type} />
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
        {formatDateForDisplay(survey.createdAt, locale)}
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
        {timeSince(survey.updatedAt.toString(), locale)}
      </div>
      {restrictedMarker ? (
        <div className="col-span-1 flex max-w-full items-center overflow-hidden text-sm whitespace-nowrap text-slate-600">
          <span className="truncate">{survey.creator ? survey.creator.name : "-"}</span>
          <RoleAccessMarker kind={restrictedMarker} workspaceName={workspaceName} />
        </div>
      ) : (
        <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
          {survey.creator ? survey.creator.name : "-"}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative block">
      {isCardNotClickable ? (
        CardBody
      ) : (
        <Link href={linkHref} key={survey.id} className="block">
          {CardBody}
        </Link>
      )}
      {/* Below the row and outside its link: a button inside a link is neither valid markup nor
          reachable, and a strip keeps the row's columns aligned with every other row. */}
      {canMakeVisible && (
        <div className="flex justify-end rounded-b-xl border border-t-0 border-slate-200 bg-amber-50 px-4 pb-3">
          <MakeVisibleToWorkspaceButton
            workspaceName={workspaceName}
            loading={isMakingVisible}
            onClick={() => void handleMakeVisible()}
          />
        </div>
      )}
      <div className="absolute top-3.5 right-3">
        <SurveyDropDownMenu
          survey={survey}
          key={`surveys-${survey.id}`}
          publicDomain={publicDomain}
          disabled={isDropdownDisabled}
          isSurveyCreationDeletionDisabled={isSurveyCreationDeletionDisabled}
          isReadOnly={isReadOnly}
          deleteSurvey={deleteSurvey}
          updateSurveyStatus={updateSurveyStatus}
          archiveSurvey={archiveSurvey}
          restoreSurvey={restoreSurvey}
          renameSurvey={renameSurvey}
          surveyVisibilityEnabled={surveyVisibilityEnabled}
          workspaceName={workspaceName}
          listQueryKey={listQueryKey}
          onVisibilityNotEnabled={onVisibilityNotEnabled}
        />
      </div>
    </div>
  );
};
