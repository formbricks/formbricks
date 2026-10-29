import { z } from "zod";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";

export const ZActionClassParams = z.object({ actionClassId: ZId }).strict();

/** The workspace a new action is created in: the query's, authorized, never the body's. */
export const ZActionClassWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

/** A new action as the survey editor's "Create new action" form builds it. */
export const ZActionClassCreateBody = ZActionClassInput;

/** The whole action as the settings form edits it. The workspace is the action's own, not this one's. */
export const ZActionClassPatchBody = ZActionClassInput;

/** The survey the editor is open on, left out of the list of other surveys using the action. */
export const ZActionClassSurveysQuery = z.object({ excludeSurveyId: ZId.optional() }).strict();

export type TActionClassPatchBody = z.infer<typeof ZActionClassPatchBody>;
export type TActionClassCreateBody = z.infer<typeof ZActionClassCreateBody>;

/** The names of the surveys an action triggers, split by whether they are running. */
export type TActionClassSurveysResource = { activeSurveys: string[]; inactiveSurveys: string[] };
