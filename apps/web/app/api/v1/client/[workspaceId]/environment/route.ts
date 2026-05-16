import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getWorkspaceState } from "@/app/api/v1/client/[workspaceId]/environment/lib/environmentState";
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
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ workspaceId: string }> }>) => {
    const params = await props.params;

    try {
      // Basic type check for workspaceId
      if (typeof params.workspaceId !== "string") {
        return {
          response: responses.badRequestResponse("Workspace ID is required", undefined, true),
        };
      }

      const idParam = params.workspaceId.trim();

      // Validate CUID format
      const cuidValidation = ZId.safeParse(idParam);
      if (!cuidValidation.success) {
        logger.warn(
          {
            workspaceId: params.workspaceId,
            url: req.url,
            validationError: cuidValidation.error.issues[0]?.message,
          },
          "Invalid CUID format detected"
        );
        return {
          response: responses.badRequestResponse("Invalid ID format", undefined, true),
        };
      }

      // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
      const resolved = await resolveClientApiIds(idParam);
      if (!resolved) {
        return {
          response: responses.notFoundResponse("Workspace", idParam),
        };
      }

      const { workspaceId } = resolved;

      // Use optimized environment state fetcher with new caching approach
      const workspace = await getWorkspaceState(workspaceId);
      const { data } = workspace;

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
            workspaceId: params.workspaceId,
            resourceType: err.resourceType,
            resourceId: err.resourceId,
          },
          "Resource not found in environment endpoint"
        );
        return {
          response: responses.notFoundResponse(err.resourceType, err.resourceId),
        };
      }

      const error = err instanceof Error ? err : new Error(String(err));

      logger.error(
        {
          error,
          url: req.url,
          workspaceId: params.workspaceId,
        },
        "Error in GET /api/v1/client/[workspaceId]/environment"
      );
      return {
        response: responses.internalServerErrorResponse(
          "An error occurred while processing your request.",
          true
        ),
        error,
      };
    }
  },
});
