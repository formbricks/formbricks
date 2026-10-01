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
import { RestrictedVisibilityMarker } from "@/modules/survey/visibility/components/restricted-visibility-marker";
import {
  MakeVisibleToWorkspaceButton,
  RoleAccessMarker,
} from "@/modules/survey/visibility/components/role-access-marker";
import { WorkspaceVisibilityMarker } from "@/modules/survey/visibility/components/workspace-visibility-marker";
import { getRestrictedAuthor, getVisibilityErrorReaction } from "@/modules/survey/visibility/lib/collaborate";
import { type TRowVisibilityMarker, getRowVisibilityMarker } from "@/modules/survey/visibility/lib/markers";
import { type TSurveyVisibilityUiGate, showVisibilityControls } from "@/modules/survey/visibility/lib/state";
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
  /** ENG-3395: the restricted-surveys gate. While nothing is enforced the row renders exactly as before. */
  surveyVisibilityGate: TSurveyVisibilityUiGate;
  workspaceName: string;
  listQueryKey: ReturnType<typeof surveyKeys.list>;
  updateSurveyVisibility: (surveyId: string, visibility: TSurveyVisibility) => Promise<void>;
  onVisibilityNotEnabled: () => void;
}
const getSurveyStatusLabel = (
  status: TSurveyStatus,
  isScheduled: boolean,
  t: ReturnType<typeof useTranslation>["t"]
): string | undefined => {
  switch (status) {
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
};

type MakeVisibleStripProps = Pick<
  SurveyCardProps,
  "workspaceName" | "updateSurveyVisibility" | "onVisibilityNotEnabled"
> & { surveyId: string };

/** The author-gone row's one-click way out, in a strip under the row so its columns stay aligned. */
const MakeVisibleStrip = ({
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
    <div className="flex items-center justify-end gap-3 rounded-b-xl border border-t-0 border-slate-200 bg-amber-50 px-4 pb-3">
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
const SurveyNameCell = ({
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

const SurveyStatusPill = ({
  status,
  isArchived,
  isScheduled,
}: Readonly<{ status: TSurveyStatus; isArchived: boolean; isScheduled: boolean }>) => {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "col-span-1 flex w-fit items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm whitespace-nowrap text-slate-800",
        isArchived && "bg-slate-100",
        !isArchived && status === "inProgress" && "bg-emerald-50",
        !isArchived && status === "completed" && "bg-slate-200",
        !isArchived && status === "draft" && "bg-slate-100",
        !isArchived && status === "paused" && "bg-slate-100"
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
          <SurveyStatusIndicator status={status} isScheduled={isScheduled} />{" "}
          {getSurveyStatusLabel(status, isScheduled, t)}{" "}
        </>
      )}
    </div>
  );
};

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
  surveyVisibilityGate,
  workspaceName,
  listQueryKey,
  updateSurveyVisibility,
  onVisibilityNotEnabled,
}: Readonly<SurveyCardProps>) => {
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const isArchived = survey.archivedAt !== null;
  const isScheduled = !isArchived && survey.status === "paused" && survey.publishOn !== null;

  const isSurveyCreationDeletionDisabled = isReadOnly;

  const visibilityMarker = getRowVisibilityMarker({
    enforced: surveyVisibilityGate.enforced,
    visibility: survey.visibility,
    access: survey.access,
    owner: survey.owner,
  });
  const isAuthorGone = visibilityMarker?.kind === "restricted" && visibilityMarker.detail === "author_gone";
  const canMakeVisible = isAuthorGone && showVisibilityControls(surveyVisibilityGate, survey.access);

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
        // `pr-14` rather than `pr-8`: the options button is absolutely positioned at `right-3` and is
        // ~34px wide, so it reached into the last column's track. The creator name centred in that
        // track ran under the button instead of eliding before it.
        "grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-14 shadow-xs transition-colors ease-in-out",
        !isCardNotClickable && "hover:border-slate-400",
        isAuthorGone && "bg-amber-50",
        canMakeVisible && "rounded-b-none border-b-0"
      )}>
      <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
        <SurveyNameCell
          name={survey.name}
          marker={visibilityMarker}
          workspaceName={workspaceName}
          author={getRestrictedAuthor(survey.access, survey.owner?.name ?? null)}
        />
      </div>
      <SurveyStatusPill status={survey.status} isArchived={isArchived} isScheduled={isScheduled} />
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
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
        {survey.creator?.name ?? "-"}
      </div>
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
        <MakeVisibleStrip
          surveyId={survey.id}
          workspaceName={workspaceName}
          updateSurveyVisibility={updateSurveyVisibility}
          onVisibilityNotEnabled={onVisibilityNotEnabled}
        />
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
          surveyVisibilityGate={surveyVisibilityGate}
          workspaceName={workspaceName}
          listQueryKey={listQueryKey}
          onVisibilityNotEnabled={onVisibilityNotEnabled}
        />
      </div>
    </div>
  );
};
