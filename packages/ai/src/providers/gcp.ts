import { createVertex } from "@ai-sdk/google-vertex";
import { AIConfigurationError } from "../errors";
import type { AIProviderAdapter } from "../registry";
import { normalizeValue } from "../shared";
import type { AIEnvironment } from "../types";

type VertexProviderSettings = NonNullable<Parameters<typeof createVertex>[0]>;

const parseVertexCredentialsJson = (value?: string | null): Record<string, unknown> | undefined => {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  return JSON.parse(normalizedValue) as Record<string, unknown>;
};

export const gcpProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    if (!normalizeValue(environment.GOOGLE_VERTEX_PROJECT)) {
      missingFields.push("GOOGLE_VERTEX_PROJECT");
    }

    if (!normalizeValue(environment.GOOGLE_VERTEX_LOCATION)) {
      missingFields.push("GOOGLE_VERTEX_LOCATION");
    }

    const credentialsJson = normalizeValue(environment.GOOGLE_VERTEX_CREDENTIALS_JSON);
    const applicationCredentials = normalizeValue(environment.GOOGLE_APPLICATION_CREDENTIALS);

    if (!credentialsJson && !applicationCredentials) {
      missingFields.push("GOOGLE_VERTEX_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS");
    }

    if (credentialsJson) {
      try {
        parseVertexCredentialsJson(credentialsJson);
      } catch {
        invalidFields.push("GOOGLE_VERTEX_CREDENTIALS_JSON");
      }
    }

    return {
      missingFields,
      invalidFields,
    };
  },
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "gcp",
      model,
      project: normalizeValue(environment.GOOGLE_VERTEX_PROJECT),
      location: normalizeValue(environment.GOOGLE_VERTEX_LOCATION),
      hasCredentialsJson: Boolean(normalizeValue(environment.GOOGLE_VERTEX_CREDENTIALS_JSON)),
      hasApplicationCredentials: Boolean(normalizeValue(environment.GOOGLE_APPLICATION_CREDENTIALS)),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const project = normalizeValue(environment.GOOGLE_VERTEX_PROJECT);
    const location = normalizeValue(environment.GOOGLE_VERTEX_LOCATION);
    const credentialsJson = normalizeValue(environment.GOOGLE_VERTEX_CREDENTIALS_JSON);

    if (!project || !location) {
      throw new AIConfigurationError("providerNotConfigured", "GCP Vertex AI credentials are incomplete", {
        provider: "gcp",
        missingFields: ["GOOGLE_VERTEX_PROJECT", "GOOGLE_VERTEX_LOCATION"],
      });
    }

    const googleAuthOptions = credentialsJson
      ? ({
          credentials: parseVertexCredentialsJson(credentialsJson),
        } as VertexProviderSettings["googleAuthOptions"])
      : undefined;

    const vertex = createVertex({
      project,
      location,
      ...(googleAuthOptions ? { googleAuthOptions } : {}),
    });

    return vertex(model);
  },
};
