import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type TTier } from "./tiers.ts";

/**
 * Shared between the spec files and the teardown, which run in separate Playwright processes, so it
 * lives in a file. The teardown deletes by these ids even when a spec crashed half-way.
 */
export interface TRunState {
  workspaceId?: string;
  surveyIds: string[];
  failedTiers: TTier[];
}

const stateFile = (): string =>
  resolve(process.env.DEPLOYMENT_CHECK_STATE_FILE ?? `${process.env.REPORT_DIR ?? "report"}/run-state.json`);

const EMPTY: TRunState = { surveyIds: [], failedTiers: [] };

export const resetState = (): void => {
  mkdirSync(dirname(stateFile()), { recursive: true });
  writeFileSync(stateFile(), JSON.stringify(EMPTY));
};

export const readState = (): TRunState => {
  try {
    return { ...EMPTY, ...(JSON.parse(readFileSync(stateFile(), "utf8")) as Partial<TRunState>) };
  } catch {
    return { ...EMPTY, surveyIds: [], failedTiers: [] };
  }
};

export const updateState = (change: (state: TRunState) => void): void => {
  const state = readState();
  change(state);
  mkdirSync(dirname(stateFile()), { recursive: true });
  writeFileSync(stateFile(), JSON.stringify(state));
};

export const recordSurvey = (surveyId: string): void =>
  updateState((state) => {
    state.surveyIds.push(surveyId);
  });

export const markTierFailed = (tier: TTier): void =>
  updateState((state) => {
    if (!state.failedTiers.includes(tier)) state.failedTiers.push(tier);
  });
