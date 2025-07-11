"use client";

import { DocumentationButton } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/documentation-button";
import { H4 } from "@/modules/ui/components/typography";

interface DocumentationLinksProps {
  headline: string;
  links: {
    title: string;
    href: string;
    readDocsText: string;
  }[];
}

export const DocumentationLinks = ({ headline, links }: DocumentationLinksProps) => {
  return (
    <div className="flex w-full flex-col space-y-4">
      <H4 className="text-base font-medium text-slate-900">{headline}</H4>
      {links.map((link) => (
        <div key={link.title} className="flex w-full flex-col gap-3">
          <DocumentationButton href={link.href} title={link.title} readDocsText={link.readDocsText} />
        </div>
      ))}
    </div>
  );
};
