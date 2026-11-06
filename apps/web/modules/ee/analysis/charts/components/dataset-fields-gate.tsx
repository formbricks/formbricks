"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TDatasetFieldsStatus } from "@/modules/ee/analysis/charts/hooks/chart-field-catalog-query";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

/**
 * Holds back an editor whose saved rules name a dataset's own fields (an embedded-data key, an answer
 * rule's question) until those fields load, so a rule never shows its member name or a blank field; says
 * so, with a retry, when they fail. An editor that names none of them shows straight away.
 */
export const DatasetFieldsGate = ({
  status,
  isNeeded,
  children,
}: Readonly<{ status: TDatasetFieldsStatus; isNeeded: boolean; children: ReactNode }>) => {
  const { t } = useTranslation();
  if (isNeeded && status.isLoading) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner className="size-5" />
      </div>
    );
  }
  if (isNeeded && status.error) {
    return (
      <ListLoadError
        error={status.error}
        onRetry={status.retry}
        title={t("workspace.analysis.charts.dataset_fields_failed")}
      />
    );
  }
  return <>{children}</>;
};
