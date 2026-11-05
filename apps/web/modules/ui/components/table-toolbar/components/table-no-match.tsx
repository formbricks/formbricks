"use client";

import { useTranslation } from "react-i18next";

/** The no-match state inside a table body: the toolbar stays, and one click clears the filters. */
export const TableNoMatch = ({
  colSpan,
  onClearFilters,
  hasFilters,
}: Readonly<{ colSpan: number; onClearFilters: () => void; hasFilters: boolean }>) => {
  const { t } = useTranslation();
  return (
    <tr>
      <td colSpan={colSpan} className="h-32 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-slate-500">
            {hasFilters ? t("common.table_toolbar.no_rows_match") : t("common.no_results")}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:border-slate-300">
              {t("common.clear_filters")}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
