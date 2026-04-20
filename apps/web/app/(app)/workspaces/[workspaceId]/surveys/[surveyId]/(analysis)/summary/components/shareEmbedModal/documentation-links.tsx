"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";

interface DocumentationLinksProps {
  links: {
    title: string;
    href: string;
  }[];
}

export const DocumentationLinks = ({ links }: DocumentationLinksProps) => {
  const { t } = useTranslation();

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
