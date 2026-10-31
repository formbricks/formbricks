import type { TApiKeyCreateBody, TApiKeyUpdateBody } from "@/app/api/internal/api-keys/schemas";
import type { TApiKeyResource, TCreatedApiKeyResource } from "@/app/api/internal/api-keys/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/api-keys";

export const listApiKeys = ({ organizationId, signal }: { organizationId: string; signal?: AbortSignal }) =>
  getApiData<TApiKeyResource[]>(buildApiUrl(BASE_PATH, { organizationId }), { signal });

/** Mint a key. The returned `apiKey` is the plaintext key, shown once and never readable again. */
export const createApiKey = ({ organizationId, body }: { organizationId: string; body: TApiKeyCreateBody }) =>
  sendApiRequest<TCreatedApiKeyResource>(buildApiUrl(BASE_PATH, { organizationId }), {
    method: "POST",
    body,
  });

export const updateApiKey = ({ apiKeyId, body }: { apiKeyId: string; body: TApiKeyUpdateBody }) =>
  sendApiRequest<TApiKeyResource>(`${BASE_PATH}/${encodeURIComponent(apiKeyId)}`, { method: "PATCH", body });

export const deleteApiKey = (apiKeyId: string) =>
  sendApiRequest<void>(`${BASE_PATH}/${encodeURIComponent(apiKeyId)}`, { method: "DELETE" });
