"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/modules/ui/components/button";
import { CreateChartDialog } from "./create-chart-dialog";

interface CreateChartButtonProps {
  environmentId: string;
}

export function CreateChartButton({ environmentId }: CreateChartButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Chart
      </Button>
      <CreateChartDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} environmentId={environmentId} />
    </>
  );
}
