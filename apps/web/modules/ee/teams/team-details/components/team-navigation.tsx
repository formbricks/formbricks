"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/modules/ui/components/breadcrumb";
import { useTranslations } from "next-intl";

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
