"use client";

import { Unplug } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { Button } from "@/modules/ui/components/button";

export const EmptyAppSurveys = () => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  return (
    <div className="flex w-full items-center justify-center gap-8 bg-slate-100 py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white">
        <Unplug size={48} className="text-amber-500" absoluteStrokeWidth />
      </div>

      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-slate-900">
          {t("workspace.surveys.summary.youre_not_plugged_in_yet")}
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          {t("workspace.surveys.summary.connect_your_website_or_app_with_formbricks_to_get_started")}
        </p>

        <Link className="mt-2" href={`/workspaces/${workspace?.id}/app-connection`}>
          <Button size="sm" className="flex w-[120px] justify-center">
            {t("common.connect")}
          </Button>
        </Link>
      </div>
    </div>
  );
};
