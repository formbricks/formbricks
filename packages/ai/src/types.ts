import type { LanguageModelV1 } from "ai";
import type { z } from "zod";

/**
 * Supported AI providers
 */
export type AIProvider = "openai" | "anthropic";

/**
 * Configuration for different AI providers
 */
export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

/**
 * OpenAI specific configuration
 */
export interface OpenAIConfig extends AIProviderConfig {
  provider: "openai";
  model: string; // e.g., "gpt-4", "gpt-3.5-turbo"
}

/**
 * Anthropic specific configuration
 */
export interface AnthropicConfig extends AIProviderConfig {
  provider: "anthropic";
  model: string; // e.g., "claude-3-sonnet-20240229", "claude-3-haiku-20240307"
}

/**
 * Union type for all provider configurations
 */
export type ProviderConfig = OpenAIConfig | AnthropicConfig;

/**
 * Environment variables for AI configuration
 */
export interface AIEnvironmentConfig {
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_BASE_URL?: string;
}

/**
 * Options for text generation
 */
export interface GenerateTextOptions {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Options for object generation
 */
export interface GenerateObjectOptions<T extends z.ZodSchema> {
  prompt: string;
  schema: T;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Result from text generation
 */
export interface GenerateTextResult {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Result from object generation
 */
export interface GenerateObjectResult<T> {
  object: T;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Internal type for the language model instance
 */
export interface AIModelInstance {
  model: LanguageModelV1;
  config: ProviderConfig;
}
