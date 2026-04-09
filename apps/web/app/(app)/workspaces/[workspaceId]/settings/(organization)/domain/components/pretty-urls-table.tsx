"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TSurveyStatus } from "@formbricks/types/surveys/types";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

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

export const PrettyUrlsTable = ({ surveys }: PrettyUrlsTableProps) => {
  const { t } = useTranslation();

  const tableHeaders = [
    {
      label: t("workspace.settings.domain.survey_name"),
      key: "name",
    },
    {
      label: t("workspace.settings.domain.workspace"),
      key: "workspace",
    },
    {
      label: t("workspace.settings.domain.pretty_url"),
      key: "slug",
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100">
            {tableHeaders.map((header) => (
              <TableHead key={header.key} className="font-medium text-slate-500">
                {header.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b">
          {surveys.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="text-center text-slate-500">
                {t("workspace.settings.domain.no_pretty_urls")}
              </TableCell>
            </TableRow>
          )}
          {surveys.map((survey) => (
            <TableRow key={survey.id} className="border-slate-200 hover:bg-transparent">
              <TableCell className="font-medium">
                <Link
                  href={`/workspaces/${survey.workspace.id}/surveys/${survey.id}/summary`}
                  className="text-slate-900 hover:text-slate-700 hover:underline">
                  {survey.name}
                </Link>
              </TableCell>
              <TableCell>{survey.workspace.name}</TableCell>
              <TableCell>
                <IdBadge id={survey.slug ?? ""} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
