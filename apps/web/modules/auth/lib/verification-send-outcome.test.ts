import { describe, expect, test } from "vitest";
import {
  didVerificationSendFail,
  markVerificationSendFailed,
  runWithVerificationSendOutcome,
} from "./verification-send-outcome";

/**
 * The scope carries a swallowed send failure back out of Better Auth (ENG-2091): `signUpEmail` invokes
 * our `sendVerificationEmail` callback through `runInBackgroundOrAwait`, whose catch only logs, so the
 * request scope is the only channel by which `createUserAction` learns the email never went out.
 *
 * Two properties matter and are both security-adjacent: absence of information must read as "no
 * failure" (never as a failure), and one request's outcome must never bleed into another's — otherwise
 * a single transient mailer error would mislabel every later sign-up in the same process.
 */
describe("runWithVerificationSendOutcome", () => {
  test("reports no failure when nothing marked one", () => {
    expect(runWithVerificationSendOutcome(() => didVerificationSendFail())).toBe(false);
  });

  test("reports a failure marked inside the scope", () => {
    const failed = runWithVerificationSendOutcome(() => {
      markVerificationSendFailed();
      return didVerificationSendFail();
    });
    expect(failed).toBe(true);
  });

  test("survives an async boundary, which is where the callback actually runs", async () => {
    const failed = await runWithVerificationSendOutcome(async () => {
      await Promise.resolve();
      markVerificationSendFailed();
      await Promise.resolve();
      return didVerificationSendFail();
    });
    expect(failed).toBe(true);
  });

  test("does not leak between sequential scopes", () => {
    runWithVerificationSendOutcome(() => {
      markVerificationSendFailed();
    });
    expect(runWithVerificationSendOutcome(() => didVerificationSendFail())).toBe(false);
  });

  test("does not leak between concurrent scopes", async () => {
    const [failing, healthy] = await Promise.all([
      runWithVerificationSendOutcome(async () => {
        await Promise.resolve();
        markVerificationSendFailed();
        return didVerificationSendFail();
      }),
      runWithVerificationSendOutcome(async () => {
        await Promise.resolve();
        return didVerificationSendFail();
      }),
    ]);
    expect(failing).toBe(true);
    expect(healthy).toBe(false);
  });

  test("a nested scope is independent of its parent", () => {
    const result = runWithVerificationSendOutcome(() => {
      markVerificationSendFailed();
      const inner = runWithVerificationSendOutcome(() => didVerificationSendFail());
      return { inner, outer: didVerificationSendFail() };
    });
    expect(result).toEqual({ inner: false, outer: true });
  });

  test("propagates the callback's return value and its throws", () => {
    expect(runWithVerificationSendOutcome(() => "value")).toBe("value");
    expect(() =>
      runWithVerificationSendOutcome(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
  });
});

describe("outside any scope", () => {
  // The resend path calls the same Better Auth callback without opening a scope, because that endpoint
  // propagates the throw itself. Marking must be a silent no-op there, and reading must be false —
  // fail-safe: no information is not evidence of failure.
  test("marking is a no-op and reading is false", () => {
    expect(() => markVerificationSendFailed()).not.toThrow();
    expect(didVerificationSendFail()).toBe(false);
  });
});
