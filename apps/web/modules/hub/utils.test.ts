import { describe, expect, test } from "vitest";
import { NO_CONFIG_ERROR, createHubResultFromError, getErrorProblem, isHubNotConfigured } from "./utils";

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
