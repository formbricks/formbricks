import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, generateObject } from "ai";
import { buildAiManifest, buildSystemPrompt } from "./ai-manifest";
import { type WorkflowDraft, WorkflowDraftSchema } from "./schema";

export type GenerateWorkflowInput = {
  prompt: string;
  apiKey: string;
  model: string;
};

export async function generateWorkflowDraft({
  prompt,
  apiKey,
  model,
}: GenerateWorkflowInput): Promise<WorkflowDraft> {
  const openai = createOpenAI({ apiKey });
  const manifest = buildAiManifest();

  const { object } = await generateObject({
    model: openai(model),
    schema: WorkflowDraftSchema,
    system: buildSystemPrompt(manifest),
    prompt,
    providerOptions: {
      openai: { strictJsonSchema: false },
    },
  });

  return object;
}

export function humanizeAiError(err: unknown): string {
  if (NoObjectGeneratedError.isInstance(err)) {
    return "The model could not produce a valid workflow. Try rephrasing your prompt.";
  }
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("api key") || message.includes("unauthorized") || message.includes("401")) {
      return "Invalid or missing OpenAI API key. Update it in Settings.";
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return "OpenAI rate limit reached. Try again in a moment.";
    }
    if (message.includes("timeout") || message.includes("fetch failed")) {
      return "Could not reach OpenAI. Check your connection and try again.";
    }
    return err.message;
  }
  return "Something went wrong while generating the workflow.";
}
