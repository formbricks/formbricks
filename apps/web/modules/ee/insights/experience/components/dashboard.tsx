"use client";

import { Greeting } from "@/modules/ee/insights/experience/components/greeting";
import { InsightsCard } from "@/modules/ee/insights/experience/components/insights-card";
import { ExperiencePageStats } from "@/modules/ee/insights/experience/components/stats";
import { getDateFromTimeRange } from "@/modules/ee/insights/experience/lib/utils";
import { TStatsPeriod } from "@/modules/ee/insights/experience/types/stats";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TProject } from "@formbricks/types/project";
import { TUser, TUserLocale } from "@formbricks/types/user";

interface DashboardProps {
  user: TUser;
  environment: TEnvironment;
  project: TProject;
  insightsPerPage: number;
  documentsPerPage: number;
  locale: TUserLocale;
}

export const Dashboard = ({
  environment,
  project,
  user,
  insightsPerPage,
  documentsPerPage,
  locale,
}: DashboardProps) => {
  const { t } = useTranslate();
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
        projectName={project.name}
        environmentId={environment.id}
        insightsPerPage={insightsPerPage}
        documentsPerPage={documentsPerPage}
        locale={locale}
      />
    </div>
  );
};
