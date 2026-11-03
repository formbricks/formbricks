import "server-only";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import type { TAnswerKind } from "@/modules/ee/analysis/lib/answer-filter";

export const CUBE_API_TOKEN_TTL_SECONDS = 5 * 60;
export const CUBE_QUERY_SCOPE = "xm:cube:query";
export const DEFAULT_CUBE_JWT_AUDIENCE = "formbricks-cube";
export const DEFAULT_CUBE_JWT_ISSUER = "formbricks-web";

export type TCubeQuerySource =
  | "charts.aiDataProfile"
  | "internal.charts.generate"
  | "v3.charts.data"
  | "v3.charts.preview"
  | "v3.charts.fieldValues"
  | "v3.dashboards.chartData"
  | "v3.dashboards.filterValues"
  | "charts.embeddedKeyDiscovery";

/**
 * Who a chart query runs for (ENG-6582). A session or OAuth caller is a user; an API key has no user
 * behind it, so it is named by its own id rather than borrowing one. Exactly one of the two reaches the
 * signed token, so Cube's audit line can never attribute a key's query to a person.
 */
export type TCubeQueryActor = { type: "user"; id: string } | { type: "apiKey"; id: string };

export type TCubeTenantScope = {
  feedbackDirectoryId: string;
  workspaceId: string;
  organizationId: string;
  actor: TCubeQueryActor;
  source: TCubeQuerySource;
  /**
   * The dataset's embedded-data keys (ENG-6893), most frequent first. Cube compiles one model per
   * dataset and key set from them, so every query on a dataset must name the same list.
   */
  embeddedKeys?: readonly string[];
  /** The kind of each question an answer rule in the query names (ENG-6894), which picks its column. */
  answerKinds?: Readonly<Record<string, TAnswerKind>>;
};

/** The one actor claim the token carries: `userId` for a user, `apiKeyId` for an API key. */
const getActorClaim = (actor: TCubeQueryActor): { userId: string } | { apiKeyId: string } =>
  actor.type === "user" ? { userId: actor.id } : { apiKeyId: actor.id };

export type TCubeApiToken = {
  token: string;
  requestId: string;
};

export const normalizeCubeApiUrl = (baseUrl: string): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/cubejs-api/v1")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/cubejs-api/v1`;
};

export const getCubeApiCredentials = () => ({
  apiUrl: normalizeCubeApiUrl(env.CUBEJS_API_URL),
  apiSecret: env.CUBEJS_API_SECRET,
  audience: env.CUBEJS_JWT_AUDIENCE ?? DEFAULT_CUBE_JWT_AUDIENCE,
  issuer: env.CUBEJS_JWT_ISSUER ?? DEFAULT_CUBE_JWT_ISSUER,
});

export const createCubeApiToken = (
  apiSecret: string,
  tenantScope: TCubeTenantScope,
  {
    audience = DEFAULT_CUBE_JWT_AUDIENCE,
    issuer = DEFAULT_CUBE_JWT_ISSUER,
  }: {
    audience?: string;
    issuer?: string;
  } = {}
): TCubeApiToken => {
  const requestId = randomUUID();

  return {
    token: jwt.sign(
      {
        tenantId: tenantScope.feedbackDirectoryId,
        feedbackDirectoryId: tenantScope.feedbackDirectoryId,
        workspaceId: tenantScope.workspaceId,
        organizationId: tenantScope.organizationId,
        ...getActorClaim(tenantScope.actor),
        scope: CUBE_QUERY_SCOPE,
        source: tenantScope.source,
        ...(tenantScope.embeddedKeys?.length ? { edKeys: [...tenantScope.embeddedKeys] } : {}),
        ...(tenantScope.answerKinds && Object.keys(tenantScope.answerKinds).length > 0
          ? { answerKinds: { ...tenantScope.answerKinds } }
          : {}),
      },
      apiSecret,
      {
        algorithm: "HS256",
        audience,
        expiresIn: CUBE_API_TOKEN_TTL_SECONDS,
        issuer,
        jwtid: requestId,
      }
    ),
    requestId,
  };
};

export const getCubeApiConfig = (tenantScope: TCubeTenantScope) => {
  const { apiSecret, apiUrl, audience, issuer } = getCubeApiCredentials();

  return {
    apiUrl,
    audience,
    issuer,
    ...createCubeApiToken(apiSecret, tenantScope, { audience, issuer }),
  };
};
