import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import React from "react";
import { cn } from "@formbricks/lib/cn";

interface Props {
  creatorId: string;
  environmentId: string;
  className?: string;
}

export function ViewCommunityButton({ environmentId, creatorId, className }: Props): React.JSX.Element {
  const { t } = useTranslate();

  return (
    <Link
      href={{ pathname: `/environments/${environmentId}/discover`, query: { community: creatorId } }}
      className={cn(
        "bg-primary text-primary-foreground hover:bg-primary/90 ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium shadow transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}>
      {t("common.view_community")}
    </Link>
  );
}

export default ViewCommunityButton;
