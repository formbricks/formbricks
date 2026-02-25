"use client";

import { PlusIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

export function CreateChartButton() {
  const { t } = useTranslation();

  const handleClick = () => {
    toast(t("environments.analysis.charts.action_coming_soon"));
  };

  return (
    <Button onClick={handleClick}>
      <PlusIcon className="mr-2 h-4 w-4" />
      {t("environments.analysis.charts.create_chart")}
    </Button>
  );
}
