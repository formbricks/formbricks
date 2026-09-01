"use client";

import { useEnrichmentStatus } from "../hooks/use-enrichment-status";
import { EnrichmentStatusBanner } from "./enrichment-status-banner";

/**
 * Background-job status for the Feedback Data page (ENG-2128): how far the record-level AI enrichments
 * have got through the workspace's feedback records. Renders nothing until it has a usable answer — a
 * Hub that is down or unconfigured reports `unavailable`, which must not surface as an error banner,
 * since enrichment progress is context for the table below, not something the page depends on.
 *
 * Requires an `EnrichmentStatusQueryClientProvider` ancestor. That provider is supplied by the page
 * (`feedback-records-page-client.tsx`) rather than by this component, so a sibling that creates new
 * pending work — the CSV import flow in the records table — can reach the same query client to
 * invalidate this read instead of leaving the indicator stale until a manual reload.
 */
export const EnrichmentStatus = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  const { data } = useEnrichmentStatus({ workspaceId });

  if (!data || data.unavailable) return null;

  return <EnrichmentStatusBanner enrichments={data.enrichments} />;
};
