import { describe, expect, test } from "vitest";
import {
  NO_CONFIG_ERROR,
  createHubResultFromError,
  getErrorProblem,
  getHubErrorHint,
  isHubNotConfigured,
} from "./utils";

/**
 * The Hub SDK exposes the parsed problem body as `error` on its API errors. These cover the duck-typed
 * read of that shape, including the malformed variants a remote service can legitimately return.
 */
describe("getErrorProblem", () => {
  test("extracts code, detail, and invalid_params from a Hub problem body", () => {
    const err = {
      status: 422,
      error: {
        code: "validation",
        detail: "One or more request parameters are invalid",
        invalid_params: [{ name: "field_type", reason: "must be one of: text, nps" }],
      },
    };

    expect(getErrorProblem(err)).toEqual({
      code: "validation",
      problemDetail: "One or more request parameters are invalid",
      invalidParams: [{ name: "field_type", reason: "must be one of: text, nps" }],
    });
  });

  test("returns an empty object when there is no problem body", () => {
    expect(getErrorProblem(new Error("connection refused"))).toEqual({});
    expect(getErrorProblem(undefined)).toEqual({});
    expect(getErrorProblem("string error")).toEqual({});
    expect(getErrorProblem({ status: 500, error: "not an object" })).toEqual({});
  });

  test("drops malformed invalid_params entries instead of surfacing partial ones", () => {
    const err = {
      error: {
        invalid_params: [{ name: "ok", reason: "valid" }, { name: 42 }, null, { reason: "no name" }],
      },
    };

    expect(getErrorProblem(err).invalidParams).toEqual([{ name: "ok", reason: "valid" }]);
  });

  test("omits invalid_params entirely when none survive validation", () => {
    expect(getErrorProblem({ error: { invalid_params: [{ bogus: true }] } })).toEqual({});
  });
});

describe("createHubResultFromError", () => {
  test("keeps message/detail semantics and adds the problem members", () => {
    // Shaped like a real SDK APIError: an Error subclass carrying status + the parsed problem body.
    const err = Object.assign(new Error("400 Bad Request"), {
      status: 400,
      error: { code: "bad_request", detail: "cursor is not valid" },
    });

    expect(createHubResultFromError(err)).toEqual({
      data: null,
      error: {
        status: 400,
        message: "400 Bad Request",
        detail: "400 Bad Request",
        code: "bad_request",
        problemDetail: "cursor is not valid",
      },
    });
  });
});

describe("isHubNotConfigured", () => {
  test("is true only for the NO_CONFIG sentinel", () => {
    expect(isHubNotConfigured({ ...NO_CONFIG_ERROR })).toBe(true);
  });

  test("is false for a connection failure, which also has no status", () => {
    // The SDK reports a dead socket / timeout without a status, so `getErrorStatus` returns 0 for it
    // too. That is an upstream fault (502), not "the integration is switched off" (503).
    const connectionFailure = createHubResultFromError(new Error("Connection error.")).error;

    expect(connectionFailure?.status).toBe(0);
    expect(isHubNotConfigured(connectionFailure!)).toBe(false);
  });

  test("is false for a Hub error with a status", () => {
    expect(isHubNotConfigured({ status: 503, message: "Service Unavailable", detail: "" })).toBe(false);
  });
});

// The fixtures below mirror the chain the real @formbricks/hub SDK produces, captured by driving it
// against a closed port: APIConnectionError (message "Connection error.", no code) wrapping
// TypeError "fetch failed" wrapping the Node error that actually carries the errno. When the Hub
// host resolves to more than one address, Node inserts an AggregateError and the errno lives in
// `errors[]` instead — both shapes have to be recognized, hence the two positive cases.
const withCause = (message: string, cause: unknown): Error => {
  const err = new Error(message);
  (err as { cause?: unknown }).cause = cause;
  return err;
};

const errnoError = (code: string): Error => {
  const err = new Error(`connect ${code} 127.0.0.1:8080`);
  (err as { code?: string }).code = code;
  return err;
};

const sdkConnectionError = (innermost: unknown): Error =>
  withCause("Connection error.", withCause("fetch failed", innermost));

describe("getHubErrorHint", () => {
  test("flags a single-address connection refusal", () => {
    expect(getHubErrorHint(sdkConnectionError(errnoError("ECONNREFUSED")))).toContain(
      "Hub looks unreachable"
    );
  });

  test("flags a multi-address refusal, where the errno sits inside AggregateError.errors", () => {
    const aggregate = new AggregateError(
      [errnoError("ECONNREFUSED"), errnoError("ECONNREFUSED")],
      "all connection attempts failed"
    );

    expect(getHubErrorHint(sdkConnectionError(aggregate))).toContain("Hub looks unreachable");
  });

  test.each(["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH"])("flags %s", (code) => {
    expect(getHubErrorHint(sdkConnectionError(errnoError(code)))).toBeDefined();
  });

  // A Hub that answers with an error is reachable, so the hint would send readers to the wrong
  // place — this is the distinction the whole helper exists to make.
  test("stays quiet when Hub answered with an API error", () => {
    const apiError = new Error("Feedback directory not found");
    (apiError as { status?: number }).status = 404;

    expect(getHubErrorHint(apiError)).toBeUndefined();
  });

  test("stays quiet for an unrelated failure, a bare string and nullish input", () => {
    expect(getHubErrorHint(new Error("value_text must not be empty"))).toBeUndefined();
    expect(getHubErrorHint("Connection error.")).toBeUndefined();
    expect(getHubErrorHint(null)).toBeUndefined();
    expect(getHubErrorHint(undefined)).toBeUndefined();
  });

  // Node blocks a handful of ports before any socket work, which surfaces as a causeless
  // "bad port" — reachability is genuinely unknown there, so it must not claim Hub is down.
  test("stays quiet for a bad-port failure, which carries no errno", () => {
    expect(getHubErrorHint(sdkConnectionError(new Error("bad port")))).toBeUndefined();
  });

  test("terminates on a self-referencing cause chain", () => {
    const looping = new Error("loops");
    (looping as { cause?: unknown }).cause = looping;

    expect(getHubErrorHint(looping)).toBeUndefined();
  });

  test("carries no connection details, so it cannot leak host or port into logs", () => {
    const hint = getHubErrorHint(sdkConnectionError(errnoError("ECONNREFUSED")));

    expect(hint).not.toContain("127.0.0.1");
    expect(hint).not.toContain("8080");
  });
});
