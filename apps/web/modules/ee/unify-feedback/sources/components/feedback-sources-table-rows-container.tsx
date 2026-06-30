import { useTranslation } from "react-i18next";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { FeedbackSourcesTableDataRow } from "./feedback-sources-table-data-row";

interface FeedbackSourcesTableRowsContainerProps {
  feedbackSources: TFeedbackSourceWithMappings[];
  onFeedbackSourceClick: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onCsvImport: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onDuplicate: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  onToggleStatus: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  onDelete: (feedbackSourceId: string) => Promise<void>;
  isReadOnly?: boolean;
}

export const FeedbackSourcesTableRowsContainer = ({
  feedbackSources,
  onFeedbackSourceClick,
  onCsvImport,
  onDuplicate,
  onToggleStatus,
  onDelete,
  isReadOnly = false,
}: FeedbackSourcesTableRowsContainerProps) => {
  const { t } = useTranslation();

  if (feedbackSources.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-slate-500">{t("workspace.unify.no_sources_connected")}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {feedbackSources.map((feedbackSource) => (
        <FeedbackSourcesTableDataRow
          key={feedbackSource.id}
          feedbackSource={feedbackSource}
          onEdit={() => onFeedbackSourceClick(feedbackSource)}
          onCsvImport={feedbackSource.type === "csv" ? () => onCsvImport(feedbackSource) : undefined}
          onDuplicate={() => onDuplicate(feedbackSource)}
          onToggleStatus={() => onToggleStatus(feedbackSource)}
          onDelete={() => onDelete(feedbackSource.id)}
          isReadOnly={isReadOnly}
        />
      ))}
    </div>
  );
};
