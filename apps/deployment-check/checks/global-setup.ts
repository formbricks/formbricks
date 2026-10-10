import { mkdirSync } from "node:fs";
import { ConfigError, loadConfig } from "../src/config.ts";
import { resetState } from "../src/run-state.ts";

export default function globalSetup(): void {
  try {
    loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(2);
    }
    throw error;
  }

  mkdirSync(process.env.REPORT_DIR ?? "report", { recursive: true });
  resetState();
}
