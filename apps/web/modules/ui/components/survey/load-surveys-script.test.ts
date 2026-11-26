/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolveDocumentNonce } from "@/lib/csp/client-nonce";
import {
  SurveysRendererNotInstalledError,
  isSurveysRendererReady,
  loadSurveysScript,
} from "./load-surveys-script";

const SCRIPT_URL = "https://app.example.com/js/surveys.umd.cjs?v=6.2.0";

// Stand-ins for the UMD bundle. Like the real wrapper (`(function (global, factory) {...})(this, ...)`)
// the whole one receives its global and installs the renderer on it; the truncated one is the same
// bundle cut mid-transfer, so the browser fails to parse it and nothing in it runs (ENG-3601).
// Vitest's jsdom runs an injected script against jsdom's own window, which the test cannot reach,
// while the test's `window` is Node's global. `document` is the one object both share, so the
// stand-in finds the test's window there.
const WHOLE_BUNDLE =
  "(function (global) { global.formbricksSurveys = { renderSurvey: function () {}, setNonce: function (n) { global.rendererNonce = n; } }; })(document.__testWindow);";
const TRUNCATED_BUNDLE = WHOLE_BUNDLE.slice(0, 40);

const respondWith = (...bodies: string[]) => {
  const fetchMock = vi.fn();
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const injectedScripts = () => document.head.querySelectorAll("script").length;

beforeEach(() => {
  (document as unknown as { __testWindow: Window }).__testWindow = window;
  delete (window as Partial<Window>).formbricksSurveys;
  document.head.innerHTML = "";
});

describe("loadSurveysScript", () => {
  // A truncated bundle reports a SyntaxError on the window, as a browser does. Vitest's jsdom re-raises
  // a window error as uncaught (the run exits 1 with every test passing) unless the test listens for
  // it, so record them and assert on each. `window.addEventListener` reaches jsdom's own window:
  // vitest binds the global's listener methods to it.
  let scriptErrors: string[] = [];
  const recordScriptError = (event: ErrorEvent) => {
    scriptErrors.push(`${event.error?.name}: ${event.message}`);
  };
  const PARSE_ERROR = expect.stringMatching(/^SyntaxError: /);

  beforeEach(() => {
    scriptErrors = [];
    window.addEventListener("error", recordScriptError);
  });

  afterEach(() => {
    window.removeEventListener("error", recordScriptError);
    vi.unstubAllGlobals();
  });

  test("resolves once a whole bundle has installed the renderer", async () => {
    const fetchMock = respondWith(WHOLE_BUNDLE);

    await loadSurveysScript(SCRIPT_URL);

    expect(isSurveysRendererReady()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(scriptErrors).toEqual([]);
  });

  test("runs the bundle with the page's CSP nonce and hands the nonce to the renderer", async () => {
    // The root layout's provider records the page's nonce as it renders.
    resolveDocumentNonce("page-nonce");
    respondWith(WHOLE_BUNDLE);

    await loadSurveysScript(SCRIPT_URL);

    expect(document.head.querySelector("script")?.nonce).toBe("page-nonce");
    expect((window as unknown as { rendererNonce?: string }).rendererNonce).toBe("page-nonce");
  });

  test("re-fetches past the cache when the first body fails to parse, and resolves on the whole one", async () => {
    const fetchMock = respondWith(TRUNCATED_BUNDLE, WHOLE_BUNDLE);

    await loadSurveysScript(SCRIPT_URL);

    expect(isSurveysRendererReady()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(SCRIPT_URL, { cache: "reload" });
    expect(injectedScripts()).toBe(1);
    expect(scriptErrors).toEqual([PARSE_ERROR]);
  });

  test("rejects, and leaves no script behind, when every attempt fails to parse", async () => {
    const fetchMock = respondWith(TRUNCATED_BUNDLE, TRUNCATED_BUNDLE);

    await expect(loadSurveysScript(SCRIPT_URL)).rejects.toThrow(SurveysRendererNotInstalledError);

    expect(isSurveysRendererReady()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(injectedScripts()).toBe(0);
    expect(scriptErrors).toEqual([PARSE_ERROR, PARSE_ERROR]);
  });

  test("keeps the caller's cache mode on the retry", async () => {
    const fetchMock = respondWith(TRUNCATED_BUNDLE, WHOLE_BUNDLE);

    await loadSurveysScript(SCRIPT_URL, { cache: "no-store" });

    expect(fetchMock).toHaveBeenLastCalledWith(SCRIPT_URL, { cache: "no-store" });
    expect(scriptErrors).toEqual([PARSE_ERROR]);
  });

  test("rejects without injecting anything when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    await expect(loadSurveysScript(SCRIPT_URL)).rejects.toThrow("Failed to load the surveys package");

    expect(injectedScripts()).toBe(0);
    expect(scriptErrors).toEqual([]);
  });
});

describe("isSurveysRendererReady", () => {
  test("is false for the empty object a UMD bundle publishes before its factory runs", () => {
    (window as unknown as { formbricksSurveys: object }).formbricksSurveys = {};

    expect(isSurveysRendererReady()).toBe(false);
  });
});
