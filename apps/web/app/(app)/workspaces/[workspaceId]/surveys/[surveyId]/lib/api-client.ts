import type { TResponseFilterOptionsResource } from "@/app/api/internal/response-filter-options/serializers";
import { buildApiUrl, getApiData } from "@/modules/api/lib/internal-api-client";

/** The survey Responses and Summary pages' calls for their filter. Every failure is a `V3ApiError`. */

const FILTER_OPTIONS_PATH = "/api/internal/response-filter-options";

/** The tags, quotas and observed response values the survey's filter offers. */
export const getResponseFilterOptions = (surveyId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TResponseFilterOptionsResource>(buildApiUrl(FILTER_OPTIONS_PATH, { surveyId }), { signal });
