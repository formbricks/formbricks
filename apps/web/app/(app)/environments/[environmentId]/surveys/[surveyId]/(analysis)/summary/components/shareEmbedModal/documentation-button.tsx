"use client";

import { Button } from "@/modules/ui/components/button";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

interface DocumentationButtonProps {
  href: string;
  title: string;
  readDocsText: string;
}

export const DocumentationButton = ({ href, title, readDocsText }: DocumentationButtonProps) => {
  return (
    <Button variant="outline" asChild>
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
