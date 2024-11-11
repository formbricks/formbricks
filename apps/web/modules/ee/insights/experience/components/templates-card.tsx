"use client";

import { TemplateList } from "@/modules/surveys/components/TemplateList";
import { useTranslations } from "next-intl";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TTemplateFilter } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@formbricks/ui/components/Card";

interface TemplatesCardProps {
  environment: TEnvironment;
  product: TProduct;
  user: TUser;
  prefilledFilters: TTemplateFilter[];
}

export const TemplatesCard = ({ environment, product, user, prefilledFilters }: TemplatesCardProps) => {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("environments.experience.templates_card_title")}</CardTitle>
        <CardDescription>{t("environments.experience.templates_card_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <TemplateList
          environment={environment}
          product={product}
          showFilters={false}
          user={user}
          prefilledFilters={prefilledFilters}
          noPreview={true}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"></div>
      </CardContent>
    </Card>
  );
};
