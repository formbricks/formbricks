import { FolderOpenIcon, MessageSquareDashedIcon } from "lucide-react";
import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";

type FeedbackDataEmptyStateProps =
  | {
      variant: "no-directory";
      organizationId: string;
      isOwnerOrManager: boolean;
    }
  | {
      variant: "no-records";
      workspaceId: string;
      hasFeedbackSources?: boolean;
    };

export const FeedbackDataEmptyState = async (props: Readonly<FeedbackDataEmptyStateProps>) => {
  const t = await getTranslate();

  if (props.variant === "no-directory") {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <FolderOpenIcon className="size-8 text-slate-400" />
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">
            {t("workspace.unify.no_feedback_directory_linked_title")}
          </h3>
          <p className="text-sm text-balance text-slate-600">
            {props.isOwnerOrManager
              ? t("workspace.unify.no_feedback_directory_linked_admin_description")
              : t("workspace.unify.no_feedback_directory_linked_member_description")}
          </p>
        </div>
        {props.isOwnerOrManager && (
          <Button asChild size="sm">
            <Link href={`/organizations/${props.organizationId}/settings/feedback-directories`}>
              {t("workspace.unify.go_to_feedback_directories")}
            </Link>
          </Button>
        )}
      </div>
    );
  }

  const hasFeedbackSources = props.hasFeedbackSources ?? false;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <MessageSquareDashedIcon className="size-8 text-slate-400" />
      <p className="text-sm text-balance text-slate-600">
        {hasFeedbackSources
          ? t("workspace.analysis.no_feedback_records_with_sources_message")
          : t("workspace.analysis.no_feedback_records_message")}
      </p>
      <Button asChild size="sm">
        <Link href={`/workspaces/${props.workspaceId}/unify/sources`}>
          {hasFeedbackSources
            ? t("workspace.analysis.manage_feedback_sources")
            : t("workspace.analysis.setup_feedback_source")}
        </Link>
      </Button>
    </div>
  );
};
