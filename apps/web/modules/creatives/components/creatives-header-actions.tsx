"use client";

import { BlocksIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { getCreativesKitPath } from "../lib/paths";
import { NewCreativeDialog } from "./new-creative-dialog";

export const CreativesHeaderActions = ({
  workspaceId,
  isReadOnly,
}: Readonly<{ workspaceId: string; isReadOnly: boolean }>) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild>
        <Link href={getCreativesKitPath(workspaceId)}>
          <BlocksIcon />
          {t("workspace.creatives.kit_title")}
        </Link>
      </Button>
      {isReadOnly ? null : <NewCreativeDialog workspaceId={workspaceId} />}
    </div>
  );
};
