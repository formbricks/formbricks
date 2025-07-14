"use client";

import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { H4 } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

interface DocumentationLink {
  href: string;
  title: string;
}

interface DocumentationLinksSectionProps {
  title: string;
  links: DocumentationLink[];
}

const DocumentationButton = ({ href, title, readDocsText }: DocumentationLink & { readDocsText: string }) => {
  return (
    <Button variant="defaultWhite" asChild>
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <ExternalLinkIcon className="h-4 w-4 flex-shrink-0" />
          <span className="text-left text-sm">{title}</span>
        </div>
        <span>{readDocsText}</span>
      </Link>
    </Button>
  );
};

export const DocumentationLinksSection = ({ title, links }: DocumentationLinksSectionProps) => {
  const { t } = useTranslate();

  return (
    <div className="flex w-full flex-col space-y-3">
      <H4>{title}</H4>
      {links.map((link, index) => (
        <>
          <DocumentationButton
            key={index}
            href={link.href}
            title={link.title}
            readDocsText={t("common.read_docs")}
          />
          <Alert key={index} size="small" variant="link">
            <AlertTitle>{link.title}</AlertTitle>
            <AlertButton>
              <Link href={link.href} target="_blank" rel="noopener noreferrer">
                {t("common.read_docs")}
              </Link>
            </AlertButton>
          </Alert>
        </>
      ))}
    </div>
  );
};
