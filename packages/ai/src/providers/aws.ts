import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { AIConfigurationError } from "../errors";
import type { AIProviderAdapter } from "../registry";
import { normalizeValue } from "../shared";
import type { AIEnvironment } from "../types";

export const awsProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => {
    const missingFields: string[] = [];

    if (!normalizeValue(environment.AWS_REGION)) {
      missingFields.push("AWS_REGION");
    }

    if (!normalizeValue(environment.AWS_ACCESS_KEY_ID)) {
      missingFields.push("AWS_ACCESS_KEY_ID");
    }

    if (!normalizeValue(environment.AWS_SECRET_ACCESS_KEY)) {
      missingFields.push("AWS_SECRET_ACCESS_KEY");
    }

    return {
      missingFields,
      invalidFields: [],
    };
  },
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "aws",
      model,
      region: normalizeValue(environment.AWS_REGION),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const region = normalizeValue(environment.AWS_REGION);
    const accessKeyId = normalizeValue(environment.AWS_ACCESS_KEY_ID);
    const secretAccessKey = normalizeValue(environment.AWS_SECRET_ACCESS_KEY);
    const sessionToken = normalizeValue(environment.AWS_SESSION_TOKEN);

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new AIConfigurationError("providerNotConfigured", "AWS Bedrock credentials are incomplete", {
        provider: "aws",
        missingFields: ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].filter(
          (field) =>
            (field === "AWS_REGION" && !region) ||
            (field === "AWS_ACCESS_KEY_ID" && !accessKeyId) ||
            (field === "AWS_SECRET_ACCESS_KEY" && !secretAccessKey)
        ),
      });
    }

    const bedrock = createAmazonBedrock({
      region,
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    });

    return bedrock(model);
  },
};
