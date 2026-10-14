import { createApiClient } from "../src/api-client.ts";
import { cleanup } from "../src/cleanup.ts";
import { loadConfig, redact } from "../src/config.ts";
import { readState } from "../src/run-state.ts";
import { CHECK_PREFIX } from "../src/survey.ts";

/** Runs on success and failure. A cleanup failure is reported but never changes the checks' outcome. */
export default async function globalTeardown(): Promise<void> {
  const config = loadConfig(process.env);
  const state = readState();

  const problems = await cleanup({
    api: createApiClient(config),
    surveyIds: state.surveyIds,
    workspaceId: state.workspaceId ?? config.workspaceId,
    now: new Date(),
  });

  if (problems.length > 0) {
    const text = `\n⚠️  Cleanup incomplete — delete these "${CHECK_PREFIX}" surveys by hand:\n  ${problems.join("\n  ")}\n`;
    process.stdout.write(redact(text, config));
  }
}
