import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TApiClient, type TApiResponse } from "./api-client.ts";
import { readState } from "./run-state.ts";
import { createSurvey } from "./surveys-api.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dc-survey-"));
  process.env.DEPLOYMENT_CHECK_STATE_FILE = join(dir, "state.json");
});

afterEach(() => {
  delete process.env.DEPLOYMENT_CHECK_STATE_FILE;
  rmSync(dir, { recursive: true, force: true });
});

const apiReturning = (status: number, json?: unknown) =>
  ({
    post: vi.fn((): Promise<TApiResponse> => Promise.resolve({ status, ok: status < 300, text: "", json })),
  }) as unknown as TApiClient;

describe("createSurvey", () => {
  test("returns the id and records it for teardown", async () => {
    const id = await createSurvey(apiReturning(201, { data: { id: "survey1" } }), { name: "x" });

    expect(id).toBe("survey1");
    expect(readState().surveyIds).toEqual(["survey1"]);
  });

  test("tells the operator the key lacks write access on 403", async () => {
    await expect(createSurvey(apiReturning(403), {})).rejects.toThrow(/cannot create surveys.*write access/);
  });

  test("includes the API's own explanation on any other failure", async () => {
    await expect(
      createSurvey(
        apiReturning(400, { detail: "Invalid request body", invalid_params: [{ name: "a", reason: "b" }] }),
        {}
      )
    ).rejects.toThrow(/HTTP 400: Invalid request body \(a: b\)/);
  });

  test("fails and records nothing when the response carries no id", async () => {
    await expect(createSurvey(apiReturning(201, { data: {} }), {})).rejects.toThrow(/no id/);
    expect(readState().surveyIds).toEqual([]);
  });
});
