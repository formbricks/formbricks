import { z } from "zod";
import { ZSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TV3SurveyGenerateResult } from "@/app/api/v3/surveys/generate/service";
import { mcpToolOutput } from "./output-schemas";

/**
 * Output schemas for the survey tools, apart from the inputs so the strict-input test covers only inputs.
 *
 * The generated draft: `payload` is a v3 create body, opaque here because `create_survey` parses it, and
 * `validation` says whether that body would be accepted. Typed against the service's result, so a field
 * the service adds or drops fails the typecheck here.
 */
export const ZMcpGeneratedSurveyOutput = mcpToolOutput(
  z
    .object({
      language: z.string(),
      payload: z.record(z.string(), z.unknown()),
      validation: z
        .object({
          valid: z.boolean(),
          invalid_params: z.array(z.object({ name: z.string(), reason: z.string() }).loose()),
          languages: z.array(
            z.object({ code: z.string(), default: z.boolean(), enabled: z.boolean() }).loose()
          ),
        })
        .loose(),
    })
    .loose() satisfies z.ZodType<Omit<TV3SurveyGenerateResult, "payload"> & { payload: unknown }>
);

/**
 * The two visibility responses, hand-typed from the v3 contract: `SurveyVisibilityState` and
 * `SurveyVisibilityChangeResult` are named OpenAPI components, but the generated Zod bundle has no schema
 * for them (the visibility contract is hand-authored), so there is no resource schema to build from.
 * `survey-visibility-schemas.test.ts` parses representative payloads and pins the shapes; keep both in
 * step with `docs/api-v3-reference/openapi.yml` when the visibility contract changes.
 *
 * Two fields are deliberately wider than the published contract: `access.via` and `blockers[].type` are
 * open strings, because the contract says new values may appear (and `SurveyVisibilityBlocker` still
 * carries a closed enum). A published-value superset means a new sharing path or connection type does
 * not fail `tools/list` consumers or reject a result the tool itself sent.
 */
const ZMcpSurveyVisibilityOwner = z.object({ name: z.string() }).nullable();

const ZMcpSurveyVisibilityAccess = z.object({
  canManageVisibility: z.boolean(),
  // Open set, deliberately not an enum: named person and team sharing will add values, and a client
  // treats an unknown string as "some other access path" instead of branching exhaustively.
  via: z.string().describe("owner, organizationRole or workspace; more values may appear"),
});

const ZMcpSurveyVisibilityBlocker = z.object({
  id: z.string(),
  name: z.string(),
  // Open set, deliberately a superset of the published enum: new connection types may appear (`creative`
  // was added in 6.2), and a closed schema here would reject the tool's own future result.
  type: z
    .string()
    .describe("creative, dashboard, feedbackSource, integration, webhook or workflow; more may appear"),
});

export const ZMcpSurveyVisibilityStateOutput = mcpToolOutput(
  z.object({
    id: z.cuid2(),
    visibility: ZSurveyVisibility,
    owner: ZMcpSurveyVisibilityOwner,
    access: ZMcpSurveyVisibilityAccess,
    blockers: z.array(ZMcpSurveyVisibilityBlocker),
    impact: z.object({ memberCount: z.number().int(), responseCount: z.number().int() }),
    pending: ZSurveyVisibility.nullable(),
    version: z.number().int(),
    allowedTargets: z.array(ZSurveyVisibility),
  })
);

export const ZMcpSurveyVisibilityChangeOutput = mcpToolOutput(
  z.object({
    id: z.cuid2(),
    visibility: ZSurveyVisibility,
    owner: ZMcpSurveyVisibilityOwner,
    access: ZMcpSurveyVisibilityAccess,
    version: z.number().int(),
    pending: ZSurveyVisibility.nullable(),
    changedAt: z.iso.datetime({ offset: true }).nullable(),
    changedBy: z.object({ type: z.literal("user"), id: z.string(), name: z.string() }).nullable(),
  })
);
