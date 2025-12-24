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
  environment: {
    id: string;
    type: "production" | "development";
    project: {
      id: string;
      name: string;
    };
  };
  createdAt: Date;
}

interface PrettyUrlsTableProps {
  surveys: SurveyWithSlug[];
}

export const PrettyUrlsTable = ({ surveys }: PrettyUrlsTableProps) => {
  const { t } = useTranslation();

  const getEnvironmentBadgeColor = (type: string) => {
    return type === "production" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
  };

  const tableHeaders = [
    {
      label: t("environments.settings.domain.survey_name"),
      key: "name",
    },
    {
      label: t("environments.settings.domain.project"),
      key: "project",
    },
    {
      label: t("environments.settings.domain.pretty_url"),
      key: "slug",
    },
    {
      label: t("common.environment"),
      key: "environment",
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
              <TableCell colSpan={4} className="text-center text-slate-500">
                {t("environments.settings.domain.no_pretty_urls")}
              </TableCell>
            </TableRow>
          )}
          {surveys.map((survey) => (
            <TableRow key={survey.id} className="border-slate-200 hover:bg-transparent">
              <TableCell className="font-medium">
                <Link
                  href={`/environments/${survey.environment.id}/surveys/${survey.id}/summary`}
                  className="text-slate-900 hover:text-slate-700 hover:underline">
                  {survey.name}
                </Link>
              </TableCell>
              <TableCell>{survey.environment.project.name}</TableCell>
              <TableCell>
                <IdBadge id={survey.slug ?? ""} />
              </TableCell>
              <TableCell>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${getEnvironmentBadgeColor(survey.environment.type)}`}>
                  {survey.environment.type === "production"
                    ? t("common.production")
                    : t("common.development")}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
