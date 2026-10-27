import { z } from "zod";
import {
  type TCustomCssError,
  type TCustomCssInput,
  type TCustomCssScope,
  type TCustomCssWarning,
  ZCustomCssError,
  ZCustomCssWarning,
} from "@formbricks/types/custom-css";
import { V3ApiError, parseV3ApiError } from "@/modules/api/lib/v3-client";
import { type TCustomCssValidationResult, parseCustomCssValidationData } from "./validation";

/**
 * Client fetchers for the Custom CSS v3 routes (ENG-3641). Reads forward the TanStack `signal`; a
 * non-2xx response throws a `V3ApiError` — a `CustomCssApiError` when the problem carries the
 * processor's located errors, so the editor can show them next to the field.
 */

export const ZCustomCssHealthStatus = z.enum(["ok", "stale", "withheld"]);
export type TCustomCssHealthStatus = z.infer<typeof ZCustomCssHealthStatus>;

const ZSourcePair = z.object({ light: z.string().nullable(), dark: z.string().nullable() });

const ZWorkspaceCustomCssResource = z.object({
  workspaceId: z.string(),
  customCss: ZSourcePair.nullable(),
  previous: ZSourcePair.nullable().catch(null),
  status: ZCustomCssHealthStatus.catch("ok"),
  canEdit: z.boolean(),
  planAllowed: z.boolean(),
  /** Present only when `status` is `withheld`: why the saved source no longer passes. */
  errors: z.array(ZCustomCssError).optional(),
});

/** `GET|PATCH /api/v3/workspaces/{workspaceId}/custom-css`: source only, never compiled output. */
export type TWorkspaceCustomCssResource = z.infer<typeof ZWorkspaceCustomCssResource>;

export class CustomCssApiError extends V3ApiError {
  cssErrors: TCustomCssError[];

  constructor(base: V3ApiError, cssErrors: TCustomCssError[]) {
    super({
      status: base.status,
      detail: base.detail,
      code: base.code,
      requestId: base.requestId,
      invalid_params: base.invalid_params,
    });
    this.name = "CustomCssApiError";
    this.cssErrors = cssErrors;
  }
}

const ZCssErrors = z.array(ZCustomCssError).min(1);
/** The processor's located errors ride in the RFC 9457 `details` extension of a 422. */
const ZProblemWithCssErrors = z.union([
  z.object({ details: z.object({ errors: ZCssErrors }) }).transform((body) => body.details.errors),
  z.object({ errors: ZCssErrors }).transform((body) => body.errors),
]);

/** Reads the problem body once for the generic fields and once for the located CSS errors. */
const parseCustomCssProblem = async (response: Response): Promise<V3ApiError> => {
  const body = await response
    .clone()
    .json()
    .catch(() => null);
  const base = await parseV3ApiError(response);
  const cssErrors = ZProblemWithCssErrors.safeParse(body);
  return cssErrors.success ? new CustomCssApiError(base, cssErrors.data) : base;
};

/** A success body: `data`, plus the additive members a write reports beside it (`warnings`). */
const requestBody = async (
  url: string,
  init: RequestInit
): Promise<{ data: unknown; warnings?: unknown }> => {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw await parseCustomCssProblem(response);
  }
  return (await response.json()) as { data: unknown; warnings?: unknown };
};

const request = async (url: string, init: RequestInit): Promise<unknown> =>
  (await requestBody(url, init)).data;

export const validateCustomCss = async (params: {
  workspaceId: string;
  scope: TCustomCssScope;
  surveyId?: string | null;
  input: TCustomCssInput;
  signal?: AbortSignal;
}): Promise<TCustomCssValidationResult> => {
  try {
    const data = await request("/api/v3/surveys/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "customCss",
        workspaceId: params.workspaceId,
        scope: params.scope,
        ...(params.surveyId ? { surveyId: params.surveyId } : {}),
        data: { customCss: params.input },
      }),
      signal: params.signal,
    });
    return parseCustomCssValidationData(data, params.scope);
  } catch (error) {
    // A rejection that names the CSS problems is a validation answer, not a failed request.
    if (error instanceof CustomCssApiError) return { valid: false, errors: error.cssErrors };
    throw error;
  }
};

const workspaceCustomCssPath = (workspaceId: string) =>
  `/api/v3/workspaces/${encodeURIComponent(workspaceId)}/custom-css`;

export const getWorkspaceCustomCss = async (params: {
  workspaceId: string;
  signal?: AbortSignal;
}): Promise<TWorkspaceCustomCssResource> =>
  ZWorkspaceCustomCssResource.parse(
    await request(workspaceCustomCssPath(params.workspaceId), { method: "GET", signal: params.signal })
  );

export const updateWorkspaceCustomCss = async (params: {
  workspaceId: string;
  customCss: TCustomCssInput | null;
}): Promise<{ resource: TWorkspaceCustomCssResource; warnings: TCustomCssWarning[] }> => {
  const body = await requestBody(workspaceCustomCssPath(params.workspaceId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customCss: params.customCss }),
  });
  const warnings = z.array(ZCustomCssWarning).safeParse(body.warnings);
  return {
    resource: ZWorkspaceCustomCssResource.parse(body.data),
    warnings: warnings.success ? warnings.data : [],
  };
};
