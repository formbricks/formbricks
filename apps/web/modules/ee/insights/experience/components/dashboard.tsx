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
import { Tabs, TabsList, TabsTrigger } from "@formbricks/ui/components/Tabs";

interface DashboardProps {
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
}: DashboardProps) => {
  const [statsPeriod, setStatsPeriod] = useState<TStatsPeriod>("week");
  const statsFrom = getDateFromTimeRange(statsPeriod);
  return (
    <div className="container mx-auto space-y-6 p-4">
      <Greeting userName={user.name} />
      <hr className="border-slate-200" />
      <Tabs
        value={statsPeriod}
        onValueChange={(value) => value && setStatsPeriod(value as TStatsPeriod)}
        className="flex justify-center">
        <TabsList>
          <TabsTrigger value="day" aria-label="Toggle day">
            Today
          </TabsTrigger>
          <TabsTrigger value="week" aria-label="Toggle week">
            This week
          </TabsTrigger>
          <TabsTrigger value="month" aria-label="Toggle month">
            This month
          </TabsTrigger>
          <TabsTrigger value="quarter" aria-label="Toggle quarter">
            This quarter
          </TabsTrigger>
          <TabsTrigger value="all" aria-label="Toggle all">
            All time
          </TabsTrigger>
        </TabsList>
      </Tabs>
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
