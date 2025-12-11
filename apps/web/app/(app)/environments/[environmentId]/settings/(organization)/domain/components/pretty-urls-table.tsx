"use client";

import { useTranslation } from "react-i18next";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

interface SurveyWithPrettyUrl {
  id: string;
  name: string;
  prettyUrl: string;
  status: "draft" | "inProgress" | "paused" | "completed";
  project: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    type: "production" | "development";
  };
  createdAt: Date;
}

interface PrettyUrlsTableProps {
  organizationId: string;
  surveys?: SurveyWithPrettyUrl[];
}

export const PrettyUrlsTable = ({ organizationId, surveys = [] }: PrettyUrlsTableProps) => {
  const { t } = useTranslation();

  const getEnvironmentBadgeColor = (type: string) => {
    return type === "production" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
  };

  return (
    <div className="overflow-hidden rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead className="font-medium text-slate-500">
              {t("environments.settings.domain.survey_name")}
            </TableHead>
            <TableHead className="font-medium text-slate-500">
              {t("environments.settings.domain.project")}
            </TableHead>
            <TableHead className="font-medium text-slate-500">
              {t("environments.settings.domain.pretty_url")}
            </TableHead>
            <TableHead className="font-medium text-slate-500">{t("common.environment")}</TableHead>
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
              <TableCell className="font-medium">{survey.name}</TableCell>
              <TableCell>{survey.project.name}</TableCell>
              <TableCell>
                <IdBadge id={survey.prettyUrl} showCopyIconOnHover={true} />
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
