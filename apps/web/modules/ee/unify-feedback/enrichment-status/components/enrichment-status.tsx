"use client";

import { useEnrichmentStatus } from "../hooks/use-enrichment-status";
import { EnrichmentStatusQueryClientProvider } from "../query-client-provider";
import { EnrichmentStatusBanner } from "./enrichment-status-banner";

/** Reads the status; renders nothing until it has a usable answer. A Hub that is down or unconfigured
 * reports `unavailable`, which must not surface as an error banner — enrichment progress is context
 * for the table below, not something the page depends on. */
const EnrichmentStatusContent = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  const { data } = useEnrichmentStatus({ workspaceId });

  if (!data || data.unavailable) return null;

  return <EnrichmentStatusBanner enrichments={data.enrichments} />;
};

/**
 * Background-job status for the Feedback Data page (ENG-2128): how far the record-level AI enrichments
 * have got through the workspace's feedback records.
 *
 * Carries its own React Query provider so it can be dropped into the page without the surrounding
 * (still `useState`-based) records table having to move first.
 */
export const EnrichmentStatus = ({ workspaceId }: Readonly<{ workspaceId: string }>) => (
  <EnrichmentStatusQueryClientProvider>
    <EnrichmentStatusContent workspaceId={workspaceId} />
  </EnrichmentStatusQueryClientProvider>
);
