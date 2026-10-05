import { createHash } from "node:crypto";
import { type AIEnvironment, AI_PROVIDERS, type ActiveAIProvider } from "./types";

export const normalizeValue = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getCredentialFingerprint = (value?: string | null): string | null => {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return null;
  }

  return createHash("sha256").update(normalizedValue).digest("hex");
};

export const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isLoopbackHost = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "127.0.0.1" ||
  hostname === "[::1]" ||
  hostname === "::1";

/**
 * A URL the client secret may be sent to: `https`, or plain `http` only on the loopback interface,
 * where no network observer exists. Unlike the model endpoint, the token endpoint always carries a
 * credential, so there is no "takes no credentials" case that would justify cleartext elsewhere.
 */
export const isSecureCredentialUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname));
  } catch {
    return false;
  }
};

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === "string");

export const parseStringRecordJson = (value: string): Record<string, string> => {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error("Value must be valid JSON");
  }

  if (!isStringRecord(parsedValue)) {
    throw new Error("Value must be a JSON object of string values");
  }

  return parsedValue;
};

export const parseBooleanFlag = (value?: string | null): boolean => {
  const normalizedValue = normalizeValue(value)?.toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1";
};

export const getAIEnvironment = (environment?: AIEnvironment): AIEnvironment => environment ?? process.env;

export const isAIProvider = (value: string): value is ActiveAIProvider =>
  AI_PROVIDERS.includes(value as ActiveAIProvider);

export const resolveActiveAIProvider = (value?: string | null): ActiveAIProvider | null => {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue || !isAIProvider(normalizedValue)) {
    return null;
  }

  return normalizedValue;
};

export const OPENAI_COMPATIBLE_AUTH_MODES = ["api-key", "oauth2-client-credentials"] as const;
export type OpenAICompatibleAuthMode = (typeof OPENAI_COMPATIBLE_AUTH_MODES)[number];

export const OPENAI_COMPATIBLE_OAUTH_AUTH_STYLES = ["basic", "post"] as const;
export type OpenAICompatibleOAuthAuthStyle = (typeof OPENAI_COMPATIBLE_OAUTH_AUTH_STYLES)[number];

const parseEnumValue = <T extends string>(
  allowed: readonly T[],
  fallback: T,
  value?: string | null
): T | undefined => {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return fallback;
  }

  return allowed.includes(normalizedValue as T) ? (normalizedValue as T) : undefined;
};

/** `api-key` when unset; `undefined` for an unrecognised value, so callers fail closed. */
export const parseAuthMode = (value?: string | null): OpenAICompatibleAuthMode | undefined =>
  parseEnumValue(OPENAI_COMPATIBLE_AUTH_MODES, "api-key", value);

/** `basic` when unset; `undefined` for an unrecognised value. */
export const parseAuthStyle = (value?: string | null): OpenAICompatibleOAuthAuthStyle | undefined =>
  parseEnumValue(OPENAI_COMPATIBLE_OAUTH_AUTH_STYLES, "basic", value);
