import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST as DOWNLOAD } from "./downloads/route";
import { GET as SEARCH } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  accessKey: "unsplash-test-key" as string | undefined,
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...original,
    get UNSPLASH_ACCESS_KEY() {
      return mocks.accessKey;
    },
  };
});
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn(), can: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const DOWNLOAD_URL = "https://api.unsplash.com/photos/Ab3_x-9/download?ixid=M3w1";

const unsplashResult = {
  id: "Ab3_x-9",
  alt_description: "a mountain",
  user: { first_name: "Ada", last_name: "Lovelace", links: { html: "https://unsplash.com/@ada" } },
  urls: { regular: "https://images.unsplash.com/photo-1?ixid=1" },
  links: { download_location: DOWNLOAD_URL },
};

const fetchMock = vi.fn();
const upstream = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const search = (query: string, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  SEARCH(new NextRequest(`http://localhost/api/internal/unsplash-photos?${query}`, { headers }), {} as never);
const download = (body: unknown, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  DOWNLOAD(
    new NextRequest("http://localhost/api/internal/unsplash-photos/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accessKey = "unsplash-test-key";
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  fetchMock.mockResolvedValue(upstream({ results: [unsplashResult] }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/internal/unsplash-photos", () => {
  test("searches Unsplash with the key in a header, and answers the picker's shape", async () => {
    const response = await search("query=mountain&page=2");

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      {
        id: "Ab3_x-9",
        alt_description: "a mountain",
        urls: {
          regularWithAttribution:
            "https://images.unsplash.com/photo-1?ixid=1&dpr=2&authorLink=https%3A%2F%2Funsplash.com%2F%40ada&authorName=Ada%20Lovelace&utm_source=formbricks&utm_medium=referral",
          download: DOWNLOAD_URL,
        },
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    const sent = new URL(url);
    expect(`${sent.origin}${sent.pathname}`).toBe("https://api.unsplash.com/search/photos");
    expect(Object.fromEntries(sent.searchParams)).toEqual({
      query: "mountain",
      orientation: "landscape",
      per_page: "9",
      page: "2",
    });
    expect(url).not.toContain("unsplash-test-key");
    expect(init.headers.Authorization).toBe("Client-ID unsplash-test-key");
    expect(init.redirect).toBe("error");
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("defaults to the first page", async () => {
    await search("query=mountain");
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("page")).toBe("1");
  });

  test("spends the caller's own Unsplash budget, and answers 429 when it is spent", async () => {
    await search("query=mountain");
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.unsplash, USER_ID);

    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Maximum number of requests reached."));
    expect((await search("query=mountain")).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("refuses an unauthenticated caller with 401, before spending any quota", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await search("query=mountain")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([
    ["no query", ""],
    ["an empty query", "query="],
    ["an overlong query", `query=${"a".repeat(257)}`],
    ["a page below one", "query=x&page=0"],
    ["a fractional page", "query=x&page=1.5"],
    ["a page past the cap", "query=x&page=1001"],
    ["an unknown parameter", "query=x&client_id=mine"],
  ])("answers 400 for %s", async (_label, query) => {
    expect((await search(query)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("answers 503 when the instance has no access key, without calling Unsplash", async () => {
    mocks.accessKey = undefined;

    const response = await search("query=mountain");

    expect(response.status).toBe(503);
    // Which variable to set is the operator's business, not the caller's.
    expect(await response.text()).not.toContain("UNSPLASH_ACCESS_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("credits an author with one name only, without a literal null, and keeps a missing alt text null", async () => {
    fetchMock.mockResolvedValue(
      upstream({
        results: [
          {
            ...unsplashResult,
            alt_description: null,
            user: { ...unsplashResult.user, last_name: null },
          },
        ],
      })
    );

    const [photo] = (await (await search("query=mountain")).json()).data;

    expect(photo.alt_description).toBeNull();
    expect(photo.urls.regularWithAttribution).toContain("authorName=Ada&");
  });

  test.each([
    ["an error status", () => fetchMock.mockResolvedValue(upstream({ errors: ["OAuth error"] }, 401))],
    [
      "an error status with a well-formed body",
      () => fetchMock.mockResolvedValue(upstream({ results: [] }, 500)),
    ],
    ["an unexpected body", () => fetchMock.mockResolvedValue(upstream({ nope: true }))],
    ["a network failure", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
  ])("answers 502 when Unsplash gives %s", async (_label, arrange) => {
    arrange();
    const response = await search("query=mountain");

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("unsplash-test-key");
  });
});

describe("POST /api/internal/unsplash-photos/downloads", () => {
  test("reports the photo to its download location with the key in a header", async () => {
    fetchMock.mockResolvedValue(upstream({ url: "https://images.unsplash.com/photo-1" }));
    const response = await download({ downloadUrl: DOWNLOAD_URL });

    expect(response.status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(DOWNLOAD_URL);
    expect(init.headers.Authorization).toBe("Client-ID unsplash-test-key");
    expect(init.redirect).toBe("error");
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.unsplash, USER_ID);
  });

  test.each([
    ["another host", "https://evil.example/photos/x/download"],
    ["a look-alike host", "https://api.unsplash.com.evil.example/photos/x/download"],
    ["plain http", "http://api.unsplash.com/photos/x/download"],
    ["a username in the URL", "https://user@api.unsplash.com/photos/x/download"],
    ["a password in the URL", "https://:pass@api.unsplash.com/photos/x/download"],
    ["another port", "https://api.unsplash.com:8443/photos/x/download"],
    ["another path on the API host", "https://api.unsplash.com/me"],
    ["a traversal out of the download path", "https://api.unsplash.com/photos/x/download/../../me"],
    ["something that is not a URL", "not a url"],
    ["an overlong URL", `https://api.unsplash.com/photos/${"a".repeat(2048)}/download`],
  ])("refuses %s with 400 and never sends the key", async (_label, downloadUrl) => {
    expect((await download({ downloadUrl })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses a body with extra fields", async () => {
    expect((await download({ downloadUrl: DOWNLOAD_URL, extra: 1 })).status).toBe(400);
  });

  test("refuses a cross-site request with 403", async () => {
    expect((await download({ downloadUrl: DOWNLOAD_URL }, { "sec-fetch-site": "cross-site" })).status).toBe(
      403
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller with 401", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await download({ downloadUrl: DOWNLOAD_URL })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("answers 503 without an access key and 502 when Unsplash refuses", async () => {
    mocks.accessKey = undefined;
    expect((await download({ downloadUrl: DOWNLOAD_URL })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();

    mocks.accessKey = "unsplash-test-key";
    fetchMock.mockResolvedValue(upstream({ errors: ["Not found"] }, 404));
    expect((await download({ downloadUrl: DOWNLOAD_URL })).status).toBe(502);
  });

  test("answers 429 once the shared budget is spent", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Maximum number of requests reached."));

    expect((await download({ downloadUrl: DOWNLOAD_URL })).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
