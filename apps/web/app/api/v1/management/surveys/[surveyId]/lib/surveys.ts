import type { TApiAuditLog } from "@/app/lib/api/with-api-logging";
import { toUnlinkedCreativeAuditEvents } from "@/modules/creatives/lib/linked-creatives";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { deleteSurvey as deleteSharedSurvey } from "@/modules/survey/lib/surveys";

/**
 * The shared delete, which refuses while creatives open the survey (409 through `handleApiError`) and
 * unlinks archived ones: each unlink is audited under the request's own actor.
 */
export const deleteSurvey = async (surveyId: string, auditLog?: TApiAuditLog) =>
  deleteSharedSurvey(surveyId, {
    onCreativesUnlinked: async (creatives, { organizationId }) => {
      if (!auditLog) return;
      for (const event of toUnlinkedCreativeAuditEvents(
        { ...auditLog, organizationId },
        surveyId,
        creatives
      )) {
        await queueAuditEvent(event);
      }
    },
  });
