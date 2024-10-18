"use client";

import { Greeting } from "@/modules/ee/insights/experience/components/greeting";
import { InsightsCard } from "@/modules/ee/insights/experience/components/insights-card";
import { ExperiencePageStats } from "@/modules/ee/insights/experience/components/stats";
import { TemplatesCard } from "@/modules/ee/insights/experience/components/templates-card";
import { getDateFromTimeRange } from "@/modules/ee/insights/experience/lib/utils";
import { TStatsPeriod } from "@/modules/ee/insights/experience/types/stats";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TUser } from "@formbricks/types/user";
import { ToggleGroup, ToggleGroupItem } from "@formbricks/ui/components/ToggleGroup";

interface ExperiencePageProps {
  user: TUser;
  environment: TEnvironment;
  product: TProduct;
  insightsPerPage: number;
  documentsPerPage: number;
}

export const Dashboard = ({
  environment,
  product,
  user,
  insightsPerPage,
  documentsPerPage,
}: ExperiencePageProps) => {
  const [statsPeriod, setStatsPeriod] = useState<TStatsPeriod>("week");
  const statsFrom = getDateFromTimeRange(statsPeriod);
  return (
    <div className="container mx-auto space-y-6 p-4">
      <Greeting userName={user.name} />
      <ToggleGroup
        type="single"
        value={statsPeriod}
        onValueChange={(value) => value && setStatsPeriod(value as TStatsPeriod)}>
        <ToggleGroupItem value="day" aria-label="Toggle day">
          Today
        </ToggleGroupItem>
        <ToggleGroupItem value="week" aria-label="Toggle week">
          This week
        </ToggleGroupItem>
        <ToggleGroupItem value="month" aria-label="Toggle month">
          This month
        </ToggleGroupItem>
        <ToggleGroupItem value="quarter" aria-label="Toggle quarter">
          This quarter
        </ToggleGroupItem>
        <ToggleGroupItem value="all" aria-label="Toggle all">
          All time
        </ToggleGroupItem>
      </ToggleGroup>
      <ExperiencePageStats statsFrom={statsFrom} environmentId={environment.id} />
      <InsightsCard
        statsFrom={statsFrom}
        productName={product.name}
        environmentId={environment.id}
        insightsPerPage={insightsPerPage}
        documentsPerPage={documentsPerPage}
      />
      <TemplatesCard
        environment={environment}
        product={product}
        user={user}
        prefilledFilters={["link", null, "customerSuccess"]}
      />
    </div>
  );
};
