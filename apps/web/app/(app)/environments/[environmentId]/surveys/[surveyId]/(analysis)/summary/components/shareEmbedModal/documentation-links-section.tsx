"use client";

import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { H4 } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface DocumentationLink {
  href: string;
  title: string;
}

interface DocumentationLinksSectionProps {
  title: string;
  links: DocumentationLink[];
}

export const DocumentationLinksSection = ({ title, links }: DocumentationLinksSectionProps) => {
  const { t } = useTranslate();

  return (
    <div className="flex w-full flex-col space-y-3">
      <H4>{title}</H4>
      {links.map((link) => (
        <Alert key={link.title} size="small" variant="default">
          <ArrowUpRight className="size-4" />
          <AlertTitle>{link.title}</AlertTitle>
          <AlertButton>
            <Link href={link.href} target="_blank" rel="noopener noreferrer">
              {t("common.read_docs")}
            </Link>
          </AlertButton>
        </Alert>
      ))}
    </div>
  );
};
