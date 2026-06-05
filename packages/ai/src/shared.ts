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
