"use client";

import type { ComponentProps, ReactNode } from "react";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { ResponseDownloadMenu } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/ResponseDownloadMenu";
import { TableToolbar } from "@/modules/ui/components/table-toolbar";
import type { useResponseTableFilters } from "../hooks/use-response-table-filters";

export type TResponseToolbarState = {
  filterState: ReturnType<typeof useResponseTableFilters>;
  matchCount: number | null;
};

/**
 * The toolbar Responses and Summary share: Filter, chips, match count and Download. Responses adds the
 * gear (row height, columns) and its bulk actions; Summary has no rows for those to act on (ENG-6704).
 */
export const ResponseToolbar = ({
  survey,
  filterState,
  matchCount,
  isLoading,
  settings,
  selectionContent,
  className,
}: Readonly<{
  survey: TSurvey;
  filterState: ReturnType<typeof useResponseTableFilters>;
  matchCount: number | null;
  isLoading?: boolean;
  settings?: NonNullable<ComponentProps<typeof TableToolbar>["settings"]>;
  selectionContent?: ReactNode;
  className?: string;
}>) => (
  <TableToolbar
    filter={{
      properties: filterState.properties,
      filters: filterState.filters,
      onFiltersChange: filterState.setFilters,
    }}
    matchCount={{ count: matchCount }}
    actions={<ResponseDownloadMenu survey={survey} getFilters={filterState.resolveFreshCriteria} />}
    isLoading={isLoading}
    settings={settings}
    selectionContent={selectionContent}
    className={className}
  />
);
