import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import type {
  AIEnvironmentConfig,
  AIModelInstance,
  AIProvider,
  AnthropicConfig,
  OpenAIConfig,
  ProviderConfig,
} from "./types";

/**
 * Default models for each provider
 */
const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: "gpt-4",
  anthropic: "claude-3-sonnet-20240229",
};

/**
 * Get environment configuration from process.env
 */
function getEnvironmentConfig(): AIEnvironmentConfig {
  return {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AI_BASE_URL: process.env.AI_BASE_URL,
  };
}

/**
 * Create provider configuration from environment variables
 */
function createProviderConfigFromEnv(): ProviderConfig {
  const env = getEnvironmentConfig();

  // Determine provider (default to openai if not specified)
  const provider = (env.AI_PROVIDER as AIProvider) || "openai";

  // Get model for the provider
  const model = env.AI_MODEL || DEFAULT_MODELS[provider];

  // Create configuration based on provider
  switch (provider) {
    case "openai": {
      const config: OpenAIConfig = {
        provider: "openai",
        model,
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.AI_BASE_URL,
      };
      return config;
    }
    case "anthropic": {
      const config: AnthropicConfig = {
        provider: "anthropic",
        model,
        apiKey: env.ANTHROPIC_API_KEY,
        baseURL: env.AI_BASE_URL,
      };
      return config;
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Create a language model instance from provider configuration
 */
function createModelFromConfig(config: ProviderConfig): LanguageModelV1 {
  switch (config.provider) {
    case "openai": {
      const options: any = {};

      if (config.apiKey) {
        options.apiKey = config.apiKey;
      }

      if (config.baseURL) {
        options.baseURL = config.baseURL;
      }

      return openai(config.model, options);
    }
    case "anthropic": {
      const options: any = {};

      if (config.apiKey) {
        options.apiKey = config.apiKey;
      }

      if (config.baseURL) {
        options.baseURL = config.baseURL;
      }

      return anthropic(config.model, options);
    }
    default:
      throw new Error(`Unsupported provider: ${(config as ProviderConfig).provider}`);
  }
}

/**
 * Validate that required API keys are present for the configured provider
 */
function validateConfiguration(config: ProviderConfig): void {
  switch (config.provider) {
    case "openai":
      if (!config.apiKey && !process.env.OPENAI_API_KEY) {
        throw new Error(
          "OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in configuration."
        );
      }
      break;
    case "anthropic":
      if (!config.apiKey && !process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          "Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or provide apiKey in configuration."
        );
      }
      break;
    default:
      throw new Error(`Unsupported provider: ${(config as ProviderConfig).provider}`);
  }
}

/**
 * Create and configure the AI model instance
 */
export function createAIModel(customConfig?: ProviderConfig): AIModelInstance {
  // Use custom config or create from environment
  const config = customConfig || createProviderConfigFromEnv();

  // Validate the configuration
  validateConfiguration(config);

  // Create the model instance
  const model = createModelFromConfig(config);

  return {
    model,
    config,
  };
}

/**
 * Get the current provider configuration without creating a model
 */
export function getProviderConfig(): ProviderConfig {
  return createProviderConfigFromEnv();
}

/**
 * Check if AI is properly configured
 */
export function isAIConfigured(): boolean {
  try {
    const config = createProviderConfigFromEnv();
    validateConfiguration(config);
    return true;
  } catch {
    return false;
  }
}
