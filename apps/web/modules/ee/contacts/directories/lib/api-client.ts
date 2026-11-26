import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import type {
  TContactDirectory,
  TContactDirectoryCreateInput,
  TContactDirectoryList,
  TContactDirectoryTargetedSurveys,
  TContactDirectoryUpdateInput,
} from "../types";

const BASE_PATH = "/api/internal/contact-directories";

const directoryPath = (directoryId: string) => `${BASE_PATH}/${encodeURIComponent(directoryId)}`;

export const fetchContactDirectories = ({
  organizationId,
  signal,
}: {
  organizationId: string;
  signal?: AbortSignal;
}): Promise<TContactDirectoryList> =>
  getApiData<TContactDirectoryList>(buildApiUrl(BASE_PATH, { organizationId }), { signal });

export const createContactDirectory = ({
  organizationId,
  input,
}: {
  organizationId: string;
  input: TContactDirectoryCreateInput;
}): Promise<TContactDirectory> =>
  sendApiRequest<TContactDirectory>(buildApiUrl(BASE_PATH, { organizationId }), {
    method: "POST",
    body: input,
  });

export const updateContactDirectory = ({
  directoryId,
  input,
}: {
  directoryId: string;
  input: TContactDirectoryUpdateInput;
}): Promise<TContactDirectory> =>
  sendApiRequest<TContactDirectory>(directoryPath(directoryId), { method: "PATCH", body: input });

export const fetchContactDirectoryTargetedSurveys = ({
  directoryId,
  signal,
}: {
  directoryId: string;
  signal?: AbortSignal;
}): Promise<TContactDirectoryTargetedSurveys> =>
  getApiData<TContactDirectoryTargetedSurveys>(`${directoryPath(directoryId)}/targeted-surveys`, { signal });
