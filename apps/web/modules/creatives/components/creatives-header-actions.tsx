"use client";

import { BlocksIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { getCreativesKitPath } from "../lib/paths";
import { MockDataBadge } from "./mock-data-badge";
import { NewCreativeDialog } from "./new-creative-dialog";

export const CreativesHeaderActions = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <MockDataBadge />
      <Button variant="ghost" size="sm" asChild>
        <Link href={getCreativesKitPath(workspaceId)}>
          <BlocksIcon />
          {t("workspace.creatives.kit_title")}
        </Link>
      </Button>
      <NewCreativeDialog workspaceId={workspaceId} />
    </div>
  );
};
