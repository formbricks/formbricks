import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type {
  TContactDirectory,
  TContactDirectoryCreateInput,
  TContactDirectoryList,
  TContactDirectoryUpdateInput,
} from "../types";

const BASE_PATH = "/api/internal/contact-directories";
const MUTATION_TIMEOUT_MS = 15_000;

export async function fetchContactDirectories({
  organizationId,
  signal,
}: {
  organizationId: string;
  signal?: AbortSignal;
}): Promise<TContactDirectoryList> {
  const response = await fetch(`${BASE_PATH}?${new URLSearchParams({ organizationId })}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TContactDirectoryList }).data;
}

export async function createContactDirectory({
  organizationId,
  input,
}: {
  organizationId: string;
  input: TContactDirectoryCreateInput;
}): Promise<TContactDirectory> {
  const response = await fetch(`${BASE_PATH}?${new URLSearchParams({ organizationId })}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TContactDirectory }).data;
}

export async function updateContactDirectory({
  directoryId,
  input,
}: {
  directoryId: string;
  input: TContactDirectoryUpdateInput;
}): Promise<TContactDirectory> {
  const response = await fetch(`${BASE_PATH}/${encodeURIComponent(directoryId)}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TContactDirectory }).data;
}
