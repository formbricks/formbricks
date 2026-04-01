import { logger } from "@formbricks/logger";
import { ZEnvironmentId } from "@formbricks/types/environment";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironmentState } from "@/app/api/v1/client/[environmentId]/environment/lib/environmentState";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (balanced approach)
    // Allows for reasonable flexibility while still providing good performance
    // max-age=3600: 1hr browser cache
    // s-maxage=3600: 1hr Cloudflare cache
    "public, s-maxage=3600, max-age=3600"
  );
};

export const GET = withV1ApiWrapper({
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ environmentId: string }> }>) => {
    const params = await props.params;

    try {
      // Basic type check for environmentId
      if (typeof params.environmentId !== "string") {
        return {
          response: responses.badRequestResponse("Environment ID is required", undefined, true),
        };
      }

      const idParam = params.environmentId.trim();

      // Validate CUID format
      const cuidValidation = ZEnvironmentId.safeParse(idParam);
      if (!cuidValidation.success) {
        logger.warn(
          {
            environmentId: params.environmentId,
            url: req.url,
            validationError: cuidValidation.error.issues[0]?.message,
          },
          "Invalid CUID format detected"
        );
        return {
          response: responses.badRequestResponse("Invalid environment ID format", undefined, true),
        };
      }

      // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
      const resolved = await resolveClientApiIds(idParam);
      if (!resolved) {
        return {
          response: responses.notFoundResponse("Environment", idParam),
        };
      }

      const { environmentId } = resolved;

      // Use optimized environment state fetcher with new caching approach
      const environmentState = await getEnvironmentState(environmentId);
      const { data } = environmentState;

      return {
        response: responses.successResponse(
          {
            data,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour for SDK to recheck
          },
          true,
          // Cache headers aligned with Redis cache TTL (1 minute)
          // max-age=60: 1min browser cache
          // s-maxage=60: 1min Cloudflare CDN cache
          // stale-while-revalidate=60: 1min stale serving during revalidation
          // stale-if-error=60: 1min stale serving on origin errors
          "public, s-maxage=60, max-age=60, stale-while-revalidate=60, stale-if-error=60"
        ),
      };
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        logger.warn(
          {
            environmentId: params.environmentId,
            resourceType: err.resourceType,
            resourceId: err.resourceId,
          },
          "Resource not found in environment endpoint"
        );
        return {
          response: responses.notFoundResponse(err.resourceType, err.resourceId),
        };
      }

      logger.error(
        {
          error: err,
          url: req.url,
          environmentId: params.environmentId,
        },
        "Error in GET /api/v1/client/[environmentId]/environment"
      );
      return {
        response: responses.internalServerErrorResponse(
          err instanceof Error ? err.message : "Unknown error occurred",
          true
        ),
      };
    }
  },
});
