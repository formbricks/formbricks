import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TUserLocale } from "@formbricks/types/user";
import type { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";

/**
 * Data the workflow `send_email` inspector form needs to author an email with survey Follow-Ups
 * parity. Resolved server-side and threaded to the client editor as props (see
 * `getWorkflowEmailAuthoringContext`). `survey` is `null` when no survey is bound / it was deleted.
 */
export interface TWorkflowEmailAuthoringContext {
  survey: TSurvey | null;
  teamMemberDetails: TFollowUpEmailToUser[];
  userEmail: string;
  mailFrom: string;
  locale: TUserLocale;
}
