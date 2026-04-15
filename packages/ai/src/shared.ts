import { type AIEnvironment, AI_PROVIDERS, type ActiveAIProvider } from "./types";

export const normalizeValue = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
