import type { TSurveyQuotaInput } from "@formbricks/types/quota";
import type { TQuotaResource, TQuotaResponseCountResource } from "@/app/api/internal/quotas/serializers";
import { getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/quotas";

const quotaPath = (quotaId: string) => `${BASE_PATH}/${encodeURIComponent(quotaId)}`;

/** Add a quota to the survey it names. */
export const createQuota = (quota: TSurveyQuotaInput) =>
  sendApiRequest<TQuotaResource>(BASE_PATH, { method: "POST", body: quota });

/** Replace a quota's settings; it stays on the survey it was created on. */
export const updateQuota = (quotaId: string, quota: TSurveyQuotaInput) =>
  sendApiRequest<TQuotaResource>(quotaPath(quotaId), { method: "PUT", body: quota });

/** Delete a quota. */
export const deleteQuota = (quotaId: string) =>
  sendApiRequest<void>(quotaPath(quotaId), { method: "DELETE" });

/** How many responses a quota has screened in, which its limit may not go below. */
export const getQuotaResponseCount = (quotaId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TQuotaResponseCountResource>(`${quotaPath(quotaId)}/response-count`, { signal });
