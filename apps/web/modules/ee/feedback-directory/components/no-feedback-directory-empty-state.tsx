import { FolderOpenIcon } from "lucide-react";
import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";

interface NoFeedbackDirectoryEmptyStateProps {
  organizationId: string;
  isOwnerOrManager: boolean;
}

export const NoFeedbackDirectoryEmptyState = async ({
  organizationId,
  isOwnerOrManager,
}: Readonly<NoFeedbackDirectoryEmptyStateProps>) => {
  const t = await getTranslate();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <FolderOpenIcon className="size-8 text-slate-400" />
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">
          {t("workspace.unify.no_feedback_directory_linked_title")}
        </h3>
        <p className="text-balance text-sm text-slate-600">
          {isOwnerOrManager
            ? t("workspace.unify.no_feedback_directory_linked_admin_description")
            : t("workspace.unify.no_feedback_directory_linked_member_description")}
        </p>
      </div>
      {isOwnerOrManager && (
        <Button asChild size="sm">
          <Link href={`/organizations/${organizationId}/settings/feedback-directories`}>
            {t("workspace.unify.go_to_feedback_directories")}
          </Link>
        </Button>
      )}
    </div>
  );
};
