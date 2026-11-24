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
 */
const ZMcpSurveyVisibilityOwner = z.object({ name: z.string() }).nullable();

const ZMcpSurveyVisibilityAccess = z.object({
  canManageVisibility: z.boolean(),
  via: z.enum(["organizationRole", "owner", "workspace"]),
});

const ZMcpSurveyVisibilityBlocker = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["creative", "dashboard", "feedbackSource", "integration", "webhook", "workflow"]),
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
