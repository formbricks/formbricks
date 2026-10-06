import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  QSF_IMPORT_BODY_LIMIT_BYTES,
  QSF_IMPORT_MAX_IN_FLIGHT,
  QSF_IMPORT_RETRY_AFTER_SECONDS,
} from "../lib/constants";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  streamQsfImport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));
vi.mock("../lib/operations", () => ({ streamQsfImport: mocks.streamQsfImport }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

const body = {
  workspaceId: "clxx1234567890123456789012",
  fileName: "onboarding.qsf",
  qsf: { SurveyEntry: { SurveyName: "Onboarding" }, SurveyElements: [] },
};

const post = (payload: unknown = body, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest("http://localhost/api/internal/surveys/import/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    }),
    {} as never
  );

/** A response whose body stays open until `finish()`, like an import still running. */
const openStream = () => {
  let finish: () => void = () => undefined;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        finish = () => controller.close();
      },
    })
  );
  return { response, finish: () => finish() };
};

describe("POST /api/internal/surveys/import/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user_1" }, expires: "2099-01-01" });
    mocks.authenticateRequest.mockResolvedValue({ apiKeyId: "key_1" });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.streamQsfImport.mockImplementation(async () => new Response("{}\n"));
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await post();

    expect(response.status).toBe(401);
    expect(mocks.streamQsfImport).not.toHaveBeenCalled();
  });

  test("is session-only: an API key does not get in", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await post(body, { Authorization: "Bearer fbk_valid_looking_key" });

    expect(response.status).toBe(401);
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
    // A cookie is not an HTTP authentication scheme, so there is no challenge to advertise.
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });

  test("spends from the same AI rate-limit bucket as Create with AI", async () => {
    await (await post()).text();

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3SurveyGenerate, "user_1");
  });

  test("hands the validated body to the import", async () => {
    await (await post()).text();

    expect(mocks.streamQsfImport).toHaveBeenCalledWith(
      expect.objectContaining({ body, requestId: expect.any(String) })
    );
  });

  test("refuses unknown top-level keys with 400", async () => {
    const response = await post({ ...body, extra: true });

    expect(response.status).toBe(400);
    expect(mocks.streamQsfImport).not.toHaveBeenCalled();
  });

  test("answers 413 over the import's body limit", async () => {
    const response = await post(body, { "Content-Length": String(QSF_IMPORT_BODY_LIMIT_BYTES + 1) });

    expect(response.status).toBe(413);
    expect(mocks.streamQsfImport).not.toHaveBeenCalled();
  });

  test("answers 503 with Retry-After once every import slot is busy, and admits again after one ends", async () => {
    const running = Array.from({ length: QSF_IMPORT_MAX_IN_FLIGHT }, openStream);
    for (const { response } of running) {
      mocks.streamQsfImport.mockImplementationOnce(async () => response);
    }

    const admitted = await Promise.all(running.map(() => post()));
    const refused = await post();

    expect(admitted.map((response) => response.status)).toEqual(running.map(() => 200));
    expect(refused.status).toBe(503);
    expect(refused.headers.get("Retry-After")).toBe(String(QSF_IMPORT_RETRY_AFTER_SECONDS));
    await expect(refused.json()).resolves.toMatchObject({ code: "capacity_reached" });

    const first = admitted[0].text();
    running[0].finish();
    await first;
    const afterOneEnded = await post();
    expect(afterOneEnded.status).toBe(200);

    await afterOneEnded.text();
    await Promise.all(
      running.slice(1).map(async ({ finish }, index) => {
        const done = admitted[index + 1].text();
        finish();
        await done;
      })
    );
  });
});
