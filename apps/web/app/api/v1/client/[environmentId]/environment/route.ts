import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ZEnvironmentId } from "@formbricks/types/environment";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironmentState } from "@/app/api/v1/client/[environmentId]/environment/lib/environmentState";
import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";

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
  handler: async ({
    req,
    props,
  }: {
    req: NextRequest;
    props: { params: Promise<{ environmentId: string }> };
  }) => {
    const params = await props.params;

    try {
      // Basic type check for environmentId
      if (typeof params.environmentId !== "string") {
        return {
          response: responses.badRequestResponse("Environment ID is required", undefined, true),
        };
      }

      const environmentId = params.environmentId.trim();

      // Validate CUID v1 format using Zod (matches Prisma schema @default(cuid()))
      // This catches all invalid formats including:
      // - null/undefined passed as string "null" or "undefined"
      // - HTML-encoded placeholders like <environmentId> or %3C...%3E
      // - Empty or whitespace-only IDs
      // - Any other invalid CUID v1 format
      const cuidValidation = ZEnvironmentId.safeParse(environmentId);
      if (!cuidValidation.success) {
        logger.warn(
          {
            environmentId: params.environmentId,
            url: req.url,
            validationError: cuidValidation.error.errors[0]?.message,
          },
          "Invalid CUID v1 format detected"
        );
        return {
          response: responses.badRequestResponse("Invalid environment ID format", undefined, true),
        };
      }

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
        response: responses.internalServerErrorResponse(err.message, true),
      };
    }
  },
});
