"use client";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TTemplateFilter } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import { TemplateList } from "@formbricks/ui/components/TemplateList";

interface SurveyTemplatesProps {
  environment: TEnvironment;
  product: TProduct;
  user: TUser;
  prefilledFilters: TTemplateFilter[];
}

export const SurveyTemplates = ({ environment, product, user, prefilledFilters }: SurveyTemplatesProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Measure your customer experience</CardTitle>
        <CardDescription>Choose a template or start from scratch</CardDescription>
      </CardHeader>
      <CardContent>
        <TemplateList
          environment={environment}
          product={product}
          user={user}
          prefilledFilters={prefilledFilters}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"></div>
      </CardContent>
    </Card>
  );
};
