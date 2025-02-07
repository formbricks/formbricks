"use client";

import { TemplateList } from "@/modules/survey/components/template-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { TEnvironment } from "@formbricks/types/environment";
import { TTemplateFilter } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";

interface TemplatesCardProps {
  environment: TEnvironment;
  project: Project;
  user: TUser;
  prefilledFilters: TTemplateFilter[];
}

export const TemplatesCard = ({ environment, project, user, prefilledFilters }: TemplatesCardProps) => {
  const { t } = useTranslate();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("environments.experience.templates_card_title")}</CardTitle>
        <CardDescription>{t("environments.experience.templates_card_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <TemplateList
          environmentId={environment.id}
          project={project}
          showFilters={false}
          userId={user.id}
          prefilledFilters={prefilledFilters}
          noPreview={true}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"></div>
      </CardContent>
    </Card>
  );
};
