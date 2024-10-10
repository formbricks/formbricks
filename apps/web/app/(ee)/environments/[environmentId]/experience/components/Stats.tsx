"use client";

import { ActivityIcon, DollarSignIcon, InboxIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import { ToggleGroup, ToggleGroupItem } from "@formbricks/ui/components/ToggleGroup";

export const ExperiencePageStats = () => {
  const [timeRange, setTimeRange] = useState("week");

  return (
    <>
      <ToggleGroup type="single" value={timeRange} onValueChange={(value) => value && setTimeRange(value)}>
        <ToggleGroupItem value="all" aria-label="Toggle all">
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="day" aria-label="Toggle day">
          Day
        </ToggleGroupItem>
        <ToggleGroupItem value="week" aria-label="Toggle week">
          Week
        </ToggleGroupItem>
        <ToggleGroupItem value="month" aria-label="Toggle month">
          Month
        </ToggleGroupItem>
        <ToggleGroupItem value="quarter" aria-label="Toggle quarter">
          Quarter
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card x-chunk="dashboard-01-chunk-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Sentiment</CardTitle>
            <DollarSignIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
          </CardContent>
        </Card>
        <Card x-chunk="dashboard-01-chunk-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Surveys</CardTitle>
            <MessageCircleIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2350</div>
          </CardContent>
        </Card>
        <Card x-chunk="dashboard-01-chunk-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Responses</CardTitle>
            <InboxIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12,234</div>
          </CardContent>
        </Card>
        <Card x-chunk="dashboard-01-chunk-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analysed Feedbacks</CardTitle>
            <ActivityIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
