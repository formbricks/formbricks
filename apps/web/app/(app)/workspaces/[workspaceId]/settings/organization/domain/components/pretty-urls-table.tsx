"use client";

import type { TFunction } from "i18next";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TSurveyStatus } from "@formbricks/types/surveys/types";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";

interface SurveyWithSlug {
  id: string;
  name: string;
  slug: string | null;
  status: TSurveyStatus;
  workspace: {
    id: string;
    name: string;
    organizationId: string;
  };
  createdAt: Date;
}

interface PrettyUrlsTableProps {
  surveys: SurveyWithSlug[];
}

export const getPrettyUrlColumns = (t: TFunction): TSettingsTableColumn<SurveyWithSlug>[] => [
  {
    id: "name",
    header: t("workspace.settings.domain.survey_name"),
    headerClassName: "w-[40%]",
    cellClassName: "font-medium",
    cell: (survey) => (
      <Link
        href={`/workspaces/${survey.workspace.id}/surveys/${survey.id}/summary`}
        className="text-slate-900 hover:text-slate-700 hover:underline">
        {survey.name}
      </Link>
    ),
  },
  {
    id: "workspace",
    header: t("workspace.settings.domain.workspace"),
    headerClassName: "w-[30%]",
    cell: (survey) => survey.workspace.name,
  },
  {
    id: "slug",
    header: t("workspace.settings.domain.pretty_url"),
    headerClassName: "w-[30%]",
    cell: (survey) => <IdBadge id={survey.slug ?? ""} />,
  },
];

export const PrettyUrlsTable = ({ surveys }: Readonly<PrettyUrlsTableProps>) => {
  const { t } = useTranslation();

  return (
    <SettingsTable
      columns={getPrettyUrlColumns(t)}
      rows={surveys}
      getRowId={(survey) => survey.id}
      emptyMessage={t("workspace.settings.domain.no_pretty_urls")}
    />
  );
};
