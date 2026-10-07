import { ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import type { TSurveyCreateInput, TSurveyLanguage } from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { type TV3CreateSurveyBody, formatV3ZodInvalidParams } from "./schemas";

/**
 * The pure half of `POST /api/v3/surveys`: a parsed v3 document becomes the survey service's create
 * input, which is checked against the service's own write schema (`ZSurveyCreateInput` +
 * `surveyRefinement`). No I/O: the languages, the owner and the app-survey fields are resolved by the
 * caller.
 *
 * Shared by the create route and by the Qualtrics import, which runs it on a draft before handing the
 * draft to the dialog — so a draft the dialog shows is one the create will accept, and the two cannot
 * drift.
 */
export function buildV3SurveyCreateInput(
  input: TV3CreateSurveyBody,
  fields: {
    languages: TSurveyLanguage[];
    createdBy: string | null;
    /** Applied last, in order: the app-survey distribution fields, then any caller overrides. */
    overrides?: Partial<TSurveyCreateInput>;
  }
): TSurveyCreateInput {
  return {
    name: input.name,
    type: input.type,
    status: input.status,
    metadata: input.metadata,
    welcomeCard: input.welcomeCard,
    blocks: input.blocks,
    endings: input.endings,
    hiddenFields: input.hiddenFields,
    variables: input.variables,
    languages: fields.languages,
    questions: [],
    createdBy: fields.createdBy,
    ...fields.overrides,
  };
}

/**
 * What the survey service's write schema refuses in a create input, as v3 invalid params; empty when
 * it accepts it. This is what rejects, for instance, an empty label in any enabled language or two
 * choices with the same label — documents the v3 request schema admits.
 */
export function getV3SurveyCreateInputInvalidParams(input: TSurveyCreateInput): InvalidParam[] {
  const parsed = ZSurveyCreateInput.safeParse(input);
  return parsed.success ? [] : formatV3ZodInvalidParams(parsed.error, "body");
}
