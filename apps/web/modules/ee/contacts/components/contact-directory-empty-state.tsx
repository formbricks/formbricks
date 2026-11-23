import { BookUserIcon } from "lucide-react";
import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";

interface ContactDirectoryEmptyStateProps {
  readonly organizationId: string;
  readonly isOwnerOrManager: boolean;
}

/** The Contacts page of a workspace with no contact directory (spec decision 13). */
export const ContactDirectoryEmptyState = async ({
  organizationId,
  isOwnerOrManager,
}: ContactDirectoryEmptyStateProps) => {
  const t = await getTranslate();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <BookUserIcon className="size-8 text-slate-400" aria-hidden="true" />
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">
          {t("workspace.contacts.no_contact_directory_title")}
        </h3>
        <p className="text-sm text-balance text-slate-600">
          {isOwnerOrManager
            ? t("workspace.contacts.no_contact_directory_admin_description")
            : t("workspace.contacts.no_contact_directory_member_description")}
        </p>
      </div>
      {isOwnerOrManager && (
        <Button asChild size="sm">
          <Link href={`/organizations/${organizationId}/settings/contact-directories`}>
            {t("workspace.contacts.go_to_contact_directories")}
          </Link>
        </Button>
      )}
    </div>
  );
};
