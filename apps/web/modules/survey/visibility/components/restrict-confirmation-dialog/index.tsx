"use client";

import { ArrowUpRightIcon, ShieldIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useVisibilityCopy } from "@/modules/survey/visibility/hooks/use-visibility-copy";
import { type TRestrictedAuthor, groupBlockersByType } from "@/modules/survey/visibility/lib/collaborate";
import { SURVEY_VISIBILITY_DOCS_URL } from "@/modules/survey/visibility/lib/constants";
import type { TSurveyVisibilityBlocker } from "@/modules/survey/visibility/types";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";

interface RestrictConfirmationDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  workspaceName: string;
  author: TRestrictedAuthor;
  /** Who loses access; `null` while the visibility sub-resource is still loading. */
  impact: Readonly<{ memberCount: number; responseCount: number }> | null;
  blockers: readonly TSurveyVisibilityBlocker[];
  onConfirm: () => void;
  isSubmitting?: boolean;
}

const BlockerTypeLabel = ({ type }: Readonly<{ type: TSurveyVisibilityBlocker["type"] }>) => {
  const { t } = useTranslation();
  switch (type) {
    case "feedbackSource":
      return <>{t("workspace.surveys.visibility.feedback_sources")}</>;
    case "integration":
      return <>{t("common.integrations")}</>;
    case "webhook":
      return <>{t("common.webhooks")}</>;
    case "workflow":
      return <>{t("common.workflows")}</>;
    case "dashboard":
      return <>{t("workspace.surveys.visibility.dashboards")}</>;
  }
};

/**
 * Visible → Restricted always passes through here. It spells out who loses access, compares what the
 * survey can do before and after, and refuses to continue while connections still depend on it.
 */
export const RestrictConfirmationDialog = ({
  open,
  setOpen,
  workspaceName,
  author,
  impact,
  blockers,
  onConfirm,
  isSubmitting = false,
}: Readonly<RestrictConfirmationDialogProps>) => {
  const { t } = useTranslation();
  const copy = useVisibilityCopy({ workspaceName, author });
  const blockerGroups = groupBlockersByType(blockers);
  const yes = t("common.yes");
  const no = t("common.no");

  const rows = [
    {
      label: t("workspace.surveys.visibility.who_can_access"),
      before: copy.workspaceAccess,
      after: copy.restrictedAccess,
    },
    { label: t("workspace.surveys.visibility.can_collect_responses"), before: yes, after: yes },
    { label: t("workspace.surveys.visibility.feedback_sources"), before: yes, after: no },
    { label: t("common.integrations"), before: yes, after: no },
    { label: t("common.webhooks"), before: yes, after: no },
    { label: t("common.workflows"), before: yes, after: no },
  ];

  return (
    <ConfirmationModal
      open={open}
      setOpen={setOpen}
      Icon={ShieldIcon}
      title={t("workspace.surveys.visibility.restrict_dialog_title")}
      description={
        impact
          ? t("workspace.surveys.visibility.restrict_dialog_impact", {
              memberCount: impact.memberCount,
              responseCount: impact.responseCount,
              workspace: workspaceName,
            })
          : ""
      }
      body={
        <div className="space-y-4 whitespace-normal">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th scope="col" className="w-1/3 py-2 pr-2 font-normal">
                  <span className="sr-only">{t("common.visibility")}</span>
                </th>
                <th scope="col" className="py-2 pr-2 font-medium text-slate-800">
                  {copy.workspaceLabel}
                </th>
                <th scope="col" className="py-2 font-medium text-slate-800">
                  {copy.restrictedLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 align-top last:border-b-0">
                  <th scope="row" className="py-2 pr-2 font-normal text-slate-500">
                    {row.label}
                  </th>
                  <td className="py-2 pr-2 text-slate-800">{row.before}</td>
                  <td className="py-2 text-slate-800">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {blockerGroups.length > 0 && (
            <Alert variant="warning" size="default" role="status">
              <AlertTitle>{t("workspace.surveys.visibility.blocked_by_connections")}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-4">
                  {blockerGroups.map((group) => (
                    <li key={group.type}>
                      <BlockerTypeLabel type={group.type} />: {group.names.join(", ")}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <a
            href={SURVEY_VISIBILITY_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
            {t("common.learn_more")}
            <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      }
      buttonText={t("workspace.surveys.visibility.change_to_restricted")}
      buttonVariant="destructive"
      isButtonDisabled={blockerGroups.length > 0 || impact === null}
      buttonLoading={isSubmitting}
      cancelButtonText={t("workspace.surveys.visibility.keep_visible_to_workspace", {
        workspace: workspaceName,
      })}
      onConfirm={onConfirm}
    />
  );
};
