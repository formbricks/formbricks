import { createAzure } from "@ai-sdk/azure";
import { env } from "./env";

export const llmModel = createAzure({
  resourceName: env.AI_AZURE_LLM_RESSOURCE_NAME, // Azure resource name
  apiKey: env.AI_AZURE_LLM_API_KEY, // Azure API key
})(env.AI_AZURE_LLM_DEPLOYMENT_ID || "llm");

export const embeddingsModel = createAzure({
  resourceName: env.AI_AZURE_EMBEDDINGS_RESSOURCE_NAME, // Azure resource name
  apiKey: env.AI_AZURE_EMBEDDINGS_API_KEY, // Azure API key
}).embedding(env.AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID || "embeddings", {
  dimensions: 512,
});
