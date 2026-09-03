import { useEffect, useRef } from "react";
import { trackWorkflowEvent } from "../lib/analytics";
import { type TWorkflowSurface, WORKFLOW_CLIENT_EVENTS } from "../lib/analytics-events";

interface WorkflowSurfaceDetails {
  workflowId?: string;
  workflowStatus?: string;
  isReadOnly?: boolean;
}

/**
 * Reports `workflow_surface_viewed` once per screen the user lands on. `surface` is `null` while
 * the screen is still resolving (skeleton, probe query), so a loading state is never counted as a
 * visit, and a screen is reported again only when its identity changes (a different surface, or a
 * different workflow), never when a detail like the status updates underneath it.
 */
export const useTrackWorkflowSurface = (
  surface: TWorkflowSurface | null,
  { workflowId, workflowStatus, isReadOnly }: WorkflowSurfaceDetails = {}
): void => {
  const lastReportedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!surface) return;
    const identity = `${surface}:${workflowId ?? ""}`;
    if (lastReportedRef.current === identity) return;
    lastReportedRef.current = identity;

    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.surfaceViewed, {
      surface,
      workflow_id: workflowId,
      workflow_status: workflowStatus,
      is_read_only: isReadOnly,
    });
  }, [surface, workflowId, workflowStatus, isReadOnly]);
};
