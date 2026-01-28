"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { cn } from "@/lib/cn";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const TABS = [
  { name: "Dashboards", href: "dashboards" },
  { name: "Charts", href: "charts" },
];

export default function AnalysisLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ environmentId: string }>;
}) {
  const pathname = usePathname();
  const { environmentId } = use(params);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Analysis" />
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TABS.map((tab) => {
            const href = `/environments/${environmentId}/analysis/${tab.href}`;
            // Check if pathname starts with the tab href to allow for sub-routes (like dashboard detail)
            // But for exact match on list pages, we can be more specific if needed.
            // For now, simple prefix check is good for "Charts" vs "Dashboards".
            // However, "dashboards/d1" should still highlight "Dashboards".
            const isActive = pathname?.includes(`/${tab.href}`);

            return (
              <Link
                key={tab.name}
                href={href}
                className={cn(
                  isActive
                    ? "border-brand-dark text-brand-dark"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                  "whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium"
                )}>
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="pt-6">{children}</div>
    </PageContentWrapper>
  );
}
