"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CodeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface QueryViewerProps {
  query: Record<string, unknown>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional trigger; when provided, renders as CollapsibleTrigger for collapsible UX */
  trigger?: React.ReactNode;
}

export function QueryViewer({ query, isOpen, onOpenChange, trigger }: Readonly<QueryViewerProps>) {
  const { t } = useTranslation();
  return (
    <Collapsible.Root open={isOpen} onOpenChange={onOpenChange}>
      {trigger}
      <Collapsible.CollapsibleContent className="mt-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CodeIcon className="h-4 w-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900">
              {t("environments.analysis.charts.cube_js_query")}
            </h4>
          </div>
          <pre className="max-h-64 overflow-auto rounded bg-white p-3 text-xs">
            {JSON.stringify(query, null, 2)}
          </pre>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
