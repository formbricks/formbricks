"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { Button } from "@/modules/ui/components/button";

interface CreateChartButtonProps {
  environmentId: string;
}

export function CreateChartButton({ environmentId }: Readonly<CreateChartButtonProps>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Button size="sm" onClick={() => setIsDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        {t("environments.analysis.charts.create_chart")}
      </Button>
      <CreateChartDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} environmentId={environmentId} />
    </>
  );
}
