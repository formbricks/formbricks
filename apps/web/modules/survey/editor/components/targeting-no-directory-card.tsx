"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { BookUserIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationRole } from "@formbricks/database/prisma-browser";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { Button } from "@/modules/ui/components/button";

interface TargetingNoDirectoryCardProps {
  membershipRole?: OrganizationRole;
}

/**
 * The Target audience card of a workspace with no contact directory (decision 13). Filters target
 * contacts, and the workspace has none until an owner or manager assigns a directory, so the card says
 * that instead of offering filters that would match nobody.
 */
export const TargetingNoDirectoryCard = ({ membershipRole }: Readonly<TargetingNoDirectoryCardProps>) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const isOwnerOrManager = membershipRole === "owner" || membershipRole === "manager";

  return (
    <Collapsible.Root
      className="w-full overflow-hidden rounded-lg border border-slate-300 bg-white"
      onOpenChange={setOpen}
      open={open}>
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <button type="button" className="inline-flex px-4 py-4 text-left">
          <div className="flex items-center pr-5 pl-2">
            <div className="rounded-full border border-slate-300 bg-slate-100 p-1">
              <BookUserIcon className="size-4 text-slate-500" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("workspace.segments.target_audience")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("workspace.contacts.no_contact_directory_title")}
            </p>
          </div>
        </button>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="min-w-full overflow-auto">
        <hr className="text-slate-600" />
        <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
          <p className="text-sm text-balance text-slate-600">
            {isOwnerOrManager
              ? t("workspace.contacts.no_contact_directory_admin_description")
              : t("workspace.contacts.no_contact_directory_member_description")}
          </p>
          {isOwnerOrManager && workspace?.organizationId && (
            <Button asChild size="sm">
              <Link href={`/organizations/${workspace.organizationId}/settings/contact-directories`}>
                {t("workspace.contacts.go_to_contact_directories")}
              </Link>
            </Button>
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
