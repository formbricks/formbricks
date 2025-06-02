import { getEnvironmentState } from "@/app/api/v1/client/[environmentId]/environment/lib/environmentState";
import { responses } from "@/app/lib/api/response";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";

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

export const GET = async (
  request: NextRequest,
  props: {
    params: Promise<{
      environmentId: string;
    }>;
  }
): Promise<Response> => {
  const params = await props.params;

  try {
    // Simple validation for environmentId (faster than Zod for high-frequency endpoint)
    if (!params.environmentId || typeof params.environmentId !== "string") {
      return responses.badRequestResponse("Environment ID is required", undefined, true);
    }

    // Use optimized environment state fetcher with new caching approach
    const environmentState = await getEnvironmentState(params.environmentId);
    const { data } = environmentState;

    return responses.successResponse(
      {
        data,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour for SDK to recheck
      },
      true,
      // Optimized cache headers for Cloudflare CDN and browser caching
      // max-age=3600: 1hr browser cache (per guidelines)
      // s-maxage=1800: 30min Cloudflare cache (per guidelines)
      // stale-while-revalidate=1800: 30min stale serving during revalidation
      // stale-if-error=3600: 1hr stale serving on origin errors
      "public, s-maxage=1800, max-age=3600, stale-while-revalidate=1800, stale-if-error=3600"
    );
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      logger.warn("Resource not found in environment endpoint", {
        environmentId: params.environmentId,
        resourceType: err.resourceType,
        resourceId: err.resourceId,
      });
      return responses.notFoundResponse(err.resourceType, err.resourceId);
    }

    logger.error(
      {
        error: err,
        url: request.url,
        environmentId: params.environmentId,
      },
      "Error in GET /api/v1/client/[environmentId]/environment"
    );
    return responses.internalServerErrorResponse(err.message, true);
  }
};
