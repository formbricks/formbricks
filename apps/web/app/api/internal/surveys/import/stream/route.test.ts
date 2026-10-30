import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  SURVEY_IMPORT_MAX_BODY_BYTES,
  SURVEY_IMPORT_MAX_IN_FLIGHT,
  SURVEY_IMPORT_RETRY_AFTER_SECONDS,
} from "@/modules/survey/import/limits";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  streamSurveyImport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));
vi.mock("../lib/operations", () => ({ streamSurveyImport: mocks.streamSurveyImport }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

const URL_PATH = "http://localhost/api/internal/surveys/import/stream";
const workspaceId = "clxx1234567890123456789012";
const qsfText = JSON.stringify({ SurveyEntry: { SurveyName: "Onboarding" }, SurveyElements: [] });

/** The form the dialog sends: the workspace and one file part. */
const uploadForm = (
  fields: [string, string | File][] = [
    ["workspaceId", workspaceId],
    ["file", new File([qsfText], "onboarding.qsf")],
  ]
) => {
  const form = new FormData();
  for (const [name, value] of fields) form.append(name, value);
  return form;
};

/** A multipart POST as a browser sends it: the boundary in Content-Type, the length left to transport. */
const post = (form: FormData = uploadForm(), headers: Record<string, string> = {}, signal?: AbortSignal) =>
  POST(new NextRequest(URL_PATH, { method: "POST", body: form, headers, signal }), {} as never);

/** The bytes and Content-Type of `form`, to send them streamed with no Content-Length. */
const encodeForm = async (form: FormData) => {
  const request = new Request(URL_PATH, { method: "POST", body: form });
  return {
    bytes: new Uint8Array(await request.arrayBuffer()),
    contentType: request.headers.get("content-type") as string,
  };
};

const postStreamed = async (form: FormData) => {
  const { bytes, contentType } = await encodeForm(form);
  return POST(
    new NextRequest(URL_PATH, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]),
    {} as never
  );
};

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
    mocks.streamSurveyImport.mockImplementation(async () => new Response("{}\n"));
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await post();

    expect(response.status).toBe(401);
    expect(mocks.streamSurveyImport).not.toHaveBeenCalled();
  });

  test("is session-only: an API key does not get in", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await post(uploadForm(), { Authorization: "Bearer fbk_valid_looking_key" });

    expect(response.status).toBe(401);
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
    // A cookie is not an HTTP authentication scheme, so there is no challenge to advertise.
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });

  test("charges every upload to the default v3 bucket; a lane's own bucket is the operation's", async () => {
    await (await post()).text();

    expect(mocks.applyRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, "user_1");
  });

  test("hands the workspace and the uploaded file to the import, name and bytes as they came", async () => {
    await (await post()).text();

    expect(mocks.streamSurveyImport).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, file: expect.any(File), requestId: expect.any(String) })
    );
    const { file } = mocks.streamSurveyImport.mock.calls[0][0] as { file: File };
    expect(file.name).toBe("onboarding.qsf");
    await expect(file.text()).resolves.toBe(qsfText);
  });

  test("answers the old JSON body, or any body that is not multipart, with a 415 problem", async () => {
    const response = await POST(
      new NextRequest(URL_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, fileName: "onboarding.qsf", qsf: JSON.parse(qsfText) }),
      }),
      {} as never
    );

    expect(response.status).toBe(415);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({ code: "unsupported_media_type" });
    expect(mocks.streamSurveyImport).not.toHaveBeenCalled();
  });

  test.each<[string, [string, string | File][], string]>([
    ["no file part", [["workspaceId", workspaceId]], "file"],
    [
      "two file parts",
      [
        ["workspaceId", workspaceId],
        ["file", new File([qsfText], "a.qsf")],
        ["file", new File([qsfText], "b.qsf")],
      ],
      "file",
    ],
    [
      "a field the route does not take",
      [
        ["workspaceId", workspaceId],
        ["file", new File([qsfText], "a.qsf")],
        ["fileName", "a.qsf"],
      ],
      "fileName",
    ],
    ["no workspace", [["file", new File([qsfText], "a.qsf")]], "workspaceId"],
  ])("answers %s with a 400 problem naming the field", async (_label, fields, name) => {
    const response = await post(uploadForm(fields));

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      invalid_params: expect.arrayContaining([expect.objectContaining({ name })]),
    });
    expect(mocks.streamSurveyImport).not.toHaveBeenCalled();
  });

  test("reads a file past the 2 MB default without a Content-Length, since the import sets its own limit", async () => {
    const threeMegabytes = new File(["x".repeat(3 * 1024 * 1024)], "big.qsf");

    const response = await postStreamed(
      uploadForm([
        ["workspaceId", workspaceId],
        ["file", threeMegabytes],
      ])
    );

    // Never a 411: a chunked upload needs no Content-Length.
    expect(response.status).toBe(200);
    expect(mocks.streamSurveyImport).toHaveBeenCalledTimes(1);
    await response.text();
  });

  test("answers 413 from Content-Length before reading the body, naming the limit", async () => {
    const response = await post(uploadForm(), { "Content-Length": String(SURVEY_IMPORT_MAX_BODY_BYTES + 1) });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      detail: `Request body must not exceed ${SURVEY_IMPORT_MAX_BODY_BYTES} bytes`,
    });
    expect(mocks.streamSurveyImport).not.toHaveBeenCalled();
  });

  test("answers 413 for a body that streams past the limit without a Content-Length", async () => {
    const tooBig = new File([new Uint8Array(SURVEY_IMPORT_MAX_BODY_BYTES)], "big.qsf");

    const response = await postStreamed(
      uploadForm([
        ["workspaceId", workspaceId],
        ["file", tooBig],
      ])
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      detail: `Request body must not exceed ${SURVEY_IMPORT_MAX_BODY_BYTES} bytes`,
    });
    expect(mocks.streamSurveyImport).not.toHaveBeenCalled();
  });

  test("answers 429 when the same user starts a second import while one is running", async () => {
    const running = openStream();
    mocks.streamSurveyImport.mockImplementationOnce(async () => running.response);

    const first = await post();
    const second = await post();

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe(String(SURVEY_IMPORT_RETRY_AFTER_SECONDS));
    await expect(second.json()).resolves.toMatchObject({ code: "concurrency_limit_reached" });

    const done = first.text();
    running.finish();
    await done;
  });

  test("lets the user start again once they stop the import", async () => {
    mocks.streamSurveyImport.mockImplementationOnce(async () => openStream().response);

    const stopped = await post();
    await stopped.body?.cancel();
    const next = await post();

    expect(stopped.status).toBe(200);
    expect(next.status).toBe(200);
    await next.text();
  });

  test("lets the user start again once they disconnect, though nothing reads or cancels the body", async () => {
    // What Next does when the client has already gone: it aborts the request and leaves the body be.
    mocks.streamSurveyImport.mockImplementationOnce(async () => openStream().response);
    const client = new AbortController();

    const gone = await post(uploadForm(), {}, client.signal);
    client.abort();
    const next = await post();

    expect(gone.status).toBe(200);
    expect(next.status).toBe(200);
    await next.text();
  });

  test("answers 503 with Retry-After once every import slot is busy, and admits again after one ends", async () => {
    const running = Array.from({ length: SURVEY_IMPORT_MAX_IN_FLIGHT }, openStream);
    for (const { response } of running) {
      mocks.streamSurveyImport.mockImplementationOnce(async () => response);
    }
    const asUser = (id: string) => {
      mocks.getSession.mockResolvedValueOnce({ user: { id }, expires: "2099-01-01" });
      return post();
    };

    const admitted = await Promise.all(running.map((_, index) => asUser(`user_${index}`)));
    const refused = await asUser("user_late");

    expect(admitted.map((response) => response.status)).toEqual(running.map(() => 200));
    expect(refused.status).toBe(503);
    expect(refused.headers.get("Retry-After")).toBe(String(SURVEY_IMPORT_RETRY_AFTER_SECONDS));
    await expect(refused.json()).resolves.toMatchObject({ code: "capacity_reached" });

    const first = admitted[0].text();
    running[0].finish();
    await first;
    const afterOneEnded = await asUser("user_late");
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
