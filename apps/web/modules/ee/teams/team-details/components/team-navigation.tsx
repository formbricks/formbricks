"use client";

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
  return (
    <Breadcrumb className="mt-3">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="./">Teams</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{teamName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
