"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TContactAttributes } from "@formbricks/types/contact-attribute";
import type { TResponseContact } from "@formbricks/types/responses";
import { getContactIdentifier } from "@/lib/utils/contact";
import { ContactNotAvailable } from "@/modules/analysis/components/contact-not-available";
import { PersonAvatar } from "@/modules/ui/components/avatars";

interface SummaryResponseContactProps {
  readonly contact: TResponseContact | null;
  readonly contactAttributes: TContactAttributes | null;
  readonly workspaceId: string | undefined;
  readonly onLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Who answered a summary sample: a link to the contact, the saved identifier with "Contact not available"
 * when the workspace no longer reaches the contact, or Anonymous.
 */
export const SummaryResponseContact = ({
  contact,
  contactAttributes,
  workspaceId,
  onLinkClick,
}: SummaryResponseContactProps) => {
  const { t } = useTranslation();

  if (!contact) {
    return (
      <div className="group flex items-center">
        <div className="hidden md:flex">
          <PersonAvatar personId="anonymous" />
        </div>
        <p className="break-all text-slate-600 md:ml-2">{t("common.anonymous")}</p>
      </div>
    );
  }

  const identifier = getContactIdentifier(contact, contactAttributes);

  if (contact.unavailable) {
    return (
      <div className="flex flex-col items-start md:flex-row md:items-center md:gap-x-2">
        <div className="flex items-center">
          <div className="hidden md:flex">
            <PersonAvatar personId={contact.id} />
          </div>
          <p className="ph-no-capture break-all text-slate-600 md:ml-2">{identifier}</p>
        </div>
        <ContactNotAvailable />
      </div>
    );
  }

  return (
    <Link
      className="ph-no-capture group flex items-center"
      href={`/workspaces/${workspaceId}/contacts/${contact.id}`}
      onClick={onLinkClick}>
      <div className="hidden md:flex">
        <PersonAvatar personId={contact.id} />
      </div>
      <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">{identifier}</p>
    </Link>
  );
};
