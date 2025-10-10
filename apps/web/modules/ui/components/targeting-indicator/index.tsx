"use client";

import { FilterIcon, UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSegment } from "@formbricks/types/segment";

export const TargetingIndicator = ({ segment }: { segment: TSegment | null }) => {
  const { t } = useTranslation();
  const doFiltersExist = !!segment?.filters?.length;

  return (
    <div className="ml-4 flex items-center gap-4">
      {doFiltersExist ? (
        <UsersIcon className="h-6 w-6 text-slate-800" />
      ) : (
        <FilterIcon className="h-6 w-6 text-slate-800" />
      )}

      <div className="flex flex-col">
        <h3 className="text-sm font-medium text-slate-900">
          {t("environments.surveys.edit.audience")}:{" "}
          <span className="font-bold">
            {doFiltersExist
              ? t("environments.surveys.edit.targeted")
              : t("environments.surveys.edit.everyone")}
          </span>
        </h3>
        <p className="text-xs text-slate-500">
          {doFiltersExist
            ? t("environments.surveys.edit.only_people_who_match_your_targeting_can_be_surveyed")
            : t("environments.surveys.edit.without_a_filter_all_of_your_users_can_be_surveyed")}
        </p>
      </div>
    </div>
  );
};
