// Example:
// bun scripts/generate-workflow-ai.ts "Send a Slack DM summary for every completed survey response where the nps value is lower than 5"
import { generateWorkflowDraft } from "@/lib/workflows/ai-generate";

const prompt = process.argv[2];

if (!prompt) {
  console.error('Usage: bun scripts/generate-workflow-ai.ts "your prompt here"');
  process.exit(1);
}

const workflow = await generateWorkflowDraft({
  prompt,
  apiKey: process.env.OPENAI_API_KEY!,
  model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
});

console.log(JSON.stringify(workflow, null, 2));
