import { MessageSquareDashedIcon } from "lucide-react";
import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";

interface NoFeedbackRecordsStateProps {
  workspaceId: string;
  hasFeedbackSources?: boolean;
}

export const NoFeedbackRecordsState = async ({
  workspaceId,
  hasFeedbackSources = false,
}: Readonly<NoFeedbackRecordsStateProps>) => {
  const t = await getTranslate();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <MessageSquareDashedIcon className="size-8 text-slate-400" />
        <p className="text-sm text-balance text-slate-600">
          {hasFeedbackSources
            ? t("workspace.analysis.no_feedback_records_with_sources_message")
            : t("workspace.analysis.no_feedback_records_message")}
        </p>
        <Button asChild size="sm">
          <Link href={`/workspaces/${workspaceId}/settings/workspace/feedback-sources`}>
            {hasFeedbackSources
              ? t("workspace.analysis.manage_feedback_sources")
              : t("workspace.analysis.setup_feedback_source")}
          </Link>
        </Button>
      </div>
    </div>
  );
};
