import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AUTH_REQUEST_BODY_LIMIT_BYTES,
  isAuthRequestBodyLimited,
} from "@/modules/auth/lib/auth-request-body-limit";

// The handlers behind the routes are mocked out: what is under test is that the route FILES put the body
// guard in front of them, and the guard answers before any of these is reached. If a route lost its
// wrapper, the oversized request below would land in one of these mocks (or a real dependency that is not
// built for it) and the assertions on `handlerCalls` and the 413 would fail.
const { handlerCalls, jacksonMock, prepareDcrRequestMock } = vi.hoisted(() => ({
  handlerCalls: vi.fn(),
  jacksonMock: vi.fn(),
  prepareDcrRequestMock: vi.fn(async (request: Request) => request),
}));

vi.mock("@/modules/auth/lib/auth", () => ({
  auth: {
    handler: async (request: Request) => {
      handlerCalls(request);
      return new Response("handled");
    },
    api: {},
  },
}));
vi.mock("@/modules/auth/lib/mcp-dcr-application-type", () => ({ prepareDcrRequest: prepareDcrRequestMock }));
vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({ default: jacksonMock }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/auth/lib/session-revocation", () => ({ revokeSessionByToken: vi.fn() }));
vi.mock("@/modules/ee/sso/lib/sso-recovery", () => ({
  SsoRecoveryError: class extends Error {},
  completeSsoRecovery: vi.fn(),
  getSsoRecoveryFailureRedirectUrl: vi.fn(() => "http://localhost/auth/login"),
}));

type RouteModule = Record<string, unknown>;

// Every route file under /api/auth, discovered rather than listed: a new route that skips the guard
// shows up here without anyone remembering to register it.
const findRouteFiles = (dir: string, prefix = "."): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return findRouteFiles(path.join(dir, entry.name), `${prefix}/${entry.name}`);
    return /^route\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [`${prefix}/${entry.name}`] : [];
  });

const routeFiles = findRouteFiles(__dirname).sort();

// Read from source so a GET-only route is never counted as a passing 413 test it cannot run.
const postRouteFiles = routeFiles.filter((file) =>
  /\bPOST\b/.test(readFileSync(path.join(__dirname, file), "utf8"))
);

const loadRoute = (file: string) => import(/* @vite-ignore */ file) as Promise<RouteModule>;

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const OVERSIZED_BYTES = AUTH_REQUEST_BODY_LIMIT_BYTES + 1;

const oversizedPost = (url: string, headers: HeadersInit = {}) =>
  new Request(url, { method: "POST", headers, body: new Uint8Array(OVERSIZED_BYTES) });

describe("/api/auth route surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("finds the routes it is meant to guard", () => {
    expect(routeFiles).toEqual([
      "./[...all]/route.ts",
      "./saml/authorize/route.ts",
      "./saml/callback/route.ts",
      "./saml/token/route.ts",
      "./saml/userinfo/route.ts",
      "./sso/recovery/complete/route.ts",
    ]);
  });

  describe.each(routeFiles)("%s", (file) => {
    test("every exported HTTP handler goes through the body guard", async () => {
      const mod = await loadRoute(file);
      const exported = HTTP_METHODS.filter((method) => method in mod);

      expect(exported.length).toBeGreaterThan(0);
      for (const method of exported) {
        expect(isAuthRequestBodyLimited(mod[method]), `${file} ${method}`).toBe(true);
      }
    });
  });

  test.each(postRouteFiles)(
    "%s POST refuses an oversized body with 413 before doing any work",
    async (file) => {
      const mod = await loadRoute(file);
      expect(typeof mod.POST).toBe("function");
      const post = mod.POST as (request: Request) => Promise<Response>;
      const url = `http://localhost/api/auth/${file
        .replace(/^\.\/|\/route\.ts$/g, "")
        .replace("[...all]", "oauth2/register")}`;

      for (const request of [
        oversizedPost(url),
        oversizedPost(url, { "content-length": String(OVERSIZED_BYTES) }),
      ]) {
        const response = await post(request);
        expect(response.status).toBe(413);
      }
      expect(handlerCalls).not.toHaveBeenCalled();
      expect(jacksonMock).not.toHaveBeenCalled();
      expect(prepareDcrRequestMock).not.toHaveBeenCalled();
    }
  );

  describe("the SAML callback, at the same boundary", () => {
    const callback = (bytes: number) =>
      new Request("http://localhost/api/auth/saml/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new Uint8Array(bytes),
      });

    test("a body of exactly the limit reaches the handler", async () => {
      const { POST } = await loadRoute("./saml/callback/route.ts");

      const response = await (POST as (request: Request) => Promise<Response>)(
        callback(AUTH_REQUEST_BODY_LIMIT_BYTES)
      );

      // Not 413: the request reached the handler, which answers 403 because the licence mock has no SAML.
      expect(response.status).toBe(403);
      expect(jacksonMock).toHaveBeenCalledTimes(1);
    });

    test("one byte more is refused before jackson sees it", async () => {
      const { POST } = await loadRoute("./saml/callback/route.ts");

      const response = await (POST as (request: Request) => Promise<Response>)(
        callback(AUTH_REQUEST_BODY_LIMIT_BYTES + 1)
      );

      expect(response.status).toBe(413);
      expect(jacksonMock).not.toHaveBeenCalled();
    });
  });

  describe("the catch-all, at the boundary", () => {
    const register = (body: Uint8Array<ArrayBuffer>) =>
      new Request("http://localhost/api/auth/oauth2/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });

    test("a body of exactly the limit reaches the DCR preprocessing and Better Auth with its bytes intact", async () => {
      const { POST } = await loadRoute("./[...all]/route.ts");
      const body = new Uint8Array(AUTH_REQUEST_BODY_LIMIT_BYTES).fill(99);

      const response = await (POST as (request: Request) => Promise<Response>)(register(body));

      expect(response.status).toBe(200);
      expect(prepareDcrRequestMock).toHaveBeenCalledTimes(1);
      expect(handlerCalls).toHaveBeenCalledTimes(1);
      const forwarded = handlerCalls.mock.calls[0][0] as Request;
      expect(new Uint8Array(await forwarded.arrayBuffer())).toEqual(body);
    });

    test("one byte more is refused before the DCR preprocessing sees it", async () => {
      const { POST } = await loadRoute("./[...all]/route.ts");

      const response = await (POST as (request: Request) => Promise<Response>)(
        register(new Uint8Array(AUTH_REQUEST_BODY_LIMIT_BYTES + 1))
      );

      expect(response.status).toBe(413);
      expect(prepareDcrRequestMock).not.toHaveBeenCalled();
      expect(handlerCalls).not.toHaveBeenCalled();
    });
  });
});
