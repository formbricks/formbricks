"use client";

import { Greeting } from "@/modules/ee/insights/experience/components/greeting";
import { InsightsCard } from "@/modules/ee/insights/experience/components/insights-card";
import { ExperiencePageStats } from "@/modules/ee/insights/experience/components/stats";
import { getDateFromTimeRange } from "@/modules/ee/insights/experience/lib/utils";
import { TStatsPeriod } from "@/modules/ee/insights/experience/types/stats";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { Tabs, TabsList, TabsTrigger } from "@formbricks/ui/components/Tabs";

interface DashboardProps {
  user: TUser;
  environment: TEnvironment;
  product: TProduct;
  insightsPerPage: number;
  documentsPerPage: number;
  locale: TUserLocale;
}

export const Dashboard = ({
  environment,
  product,
  user,
  insightsPerPage,
  documentsPerPage,
  locale,
}: DashboardProps) => {
  const t = useTranslations();
  const [statsPeriod, setStatsPeriod] = useState<TStatsPeriod>("week");
  const statsFrom = getDateFromTimeRange(statsPeriod);
  return (
    <div className="container mx-auto space-y-6 p-4">
      <Greeting userName={user.name} />
      <hr className="border-slate-200" />
      <Tabs
        value={statsPeriod}
        onValueChange={(value) => {
          if (value) {
            console.log("Stats period changed to:", value);
            setStatsPeriod(value as TStatsPeriod);
          }
        }}
        className="flex justify-center">
        <TabsList>
          <TabsTrigger value="day" aria-label="Toggle day">
            {t("environments.experience.today")}
          </TabsTrigger>
          <TabsTrigger value="week" aria-label="Toggle week">
            {t("environments.experience.this_week")}
          </TabsTrigger>
          <TabsTrigger value="month" aria-label="Toggle month">
            {t("environments.experience.this_month")}
          </TabsTrigger>
          <TabsTrigger value="quarter" aria-label="Toggle quarter">
            {t("environments.experience.this_quarter")}
          </TabsTrigger>
          <TabsTrigger value="all" aria-label="Toggle all">
            {t("environments.experience.all_time")}
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
        locale={locale}
      />
    </div>
  );
};
