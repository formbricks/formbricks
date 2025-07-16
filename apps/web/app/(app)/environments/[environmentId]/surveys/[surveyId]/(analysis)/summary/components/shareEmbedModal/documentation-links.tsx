"use client";

import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";

interface DocumentationLinksProps {
  links: {
    title: string;
    href: string;
  }[];
}

export const DocumentationLinks = ({ links }: DocumentationLinksProps) => {
  const { t } = useTranslate();

  return (
    <div className="flex w-full flex-col space-y-2">
      {links.map((link) => (
        <div key={link.title} className="flex w-full flex-col gap-3">
          <Alert variant="outbound" size="small">
            <AlertTitle>{link.title}</AlertTitle>
            <AlertButton asChild>
              <Link
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-900 hover:underline">
                {t("common.learn_more")}
              </Link>
            </AlertButton>
          </Alert>
        </div>
      ))}
    </div>
  );
};
