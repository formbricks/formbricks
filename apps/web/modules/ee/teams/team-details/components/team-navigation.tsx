"use client";

import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@formbricks/ui/components/Breadcrumb";

interface TeamsNavigationBreadcrumbsProps {
  teamName: string;
}

export function TeamsNavigationBreadcrumbs({ teamName }: TeamsNavigationBreadcrumbsProps) {
  const t = useTranslations();
  return (
    <Breadcrumb className="mt-3">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="./">{t("common.teams")}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{teamName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
