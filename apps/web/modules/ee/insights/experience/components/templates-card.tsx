"use client";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TTemplateFilter } from "@formbricks/types/templates";
import { TUser } from "@formbricks/types/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import { TemplateList } from "@formbricks/ui/components/TemplateList";

interface TemplatesCardProps {
  environment: TEnvironment;
  product: TProduct;
  user: TUser;
  prefilledFilters: TTemplateFilter[];
}

export const TemplatesCard = ({ environment, product, user, prefilledFilters }: TemplatesCardProps) => {
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
