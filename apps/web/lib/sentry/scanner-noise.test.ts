import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, test } from "vitest";
import { isScannerMultipartNoise } from "./scanner-noise";

const undiciFrame = (fn: string) => ({
  filename: "node:internal/deps/undici/undici",
  function: fn,
});

const appFrame = () => ({
  filename: "/home/nextjs/apps/web/app/api/v1/client/[workspaceId]/storage/route.ts",
  function: "POST",
});

const errorEvent = (values: NonNullable<ErrorEvent["exception"]>["values"]): ErrorEvent =>
  ({ exception: { values } }) as ErrorEvent;

const parseFailure = (frames: { filename: string; function: string }[]) => ({
  type: "TypeError",
  value: "Failed to parse body as FormData.",
  stacktrace: { frames },
});

describe("isScannerMultipartNoise", () => {
  test("drops a parse failure whose stack never leaves undici", () => {
    expect(
      isScannerMultipartNoise(
        errorEvent([parseFailure([undiciFrame("parseMultipartFormDataHeaders"), undiciFrame("formData")])])
      )
    ).toBe(true);
  });

  test("drops it when the cause is chained, as production reports it", () => {
    expect(
      isScannerMultipartNoise(
        errorEvent([
          {
            type: "Error",
            value: "missing boundary in content-type header",
            stacktrace: { frames: [undiciFrame("parseMultipartFormDataHeaders")] },
          },
          parseFailure([undiciFrame("formData")]),
        ])
      )
    ).toBe(true);
  });

  /**
   * The guard the whole module exists for. A real upload failure carries the same message, so the
   * only thing separating it from scanner traffic is that one of our frames is in the chain.
   */
  test("keeps the same message when a first-party frame is in the stack", () => {
    expect(isScannerMultipartNoise(errorEvent([parseFailure([undiciFrame("formData"), appFrame()])]))).toBe(
      false
    );
  });

  test("keeps it when a first-party frame sits in a different link of the chain", () => {
    expect(
      isScannerMultipartNoise(
        errorEvent([
          {
            type: "Error",
            value: "expected CRLF",
            stacktrace: { frames: [undiciFrame("parseMultipartFormDataHeaders"), appFrame()] },
          },
          parseFailure([undiciFrame("formData")]),
        ])
      )
    ).toBe(false);
  });

  test("keeps a parse failure that carries no stack, since it cannot be attributed", () => {
    expect(isScannerMultipartNoise(errorEvent([{ type: "TypeError", value: parseFailure([]).value }]))).toBe(
      false
    );
  });

  test("keeps a parse failure when another link in the chain carries no stack", () => {
    expect(
      isScannerMultipartNoise(
        errorEvent([
          { type: "Error", value: "missing boundary in content-type header" },
          parseFailure([undiciFrame("formData")]),
        ])
      )
    ).toBe(false);
  });

  test("keeps an unrelated error even when its stack is entirely undici", () => {
    expect(
      isScannerMultipartNoise(
        errorEvent([
          { type: "TypeError", value: "fetch failed", stacktrace: { frames: [undiciFrame("fetch")] } },
        ])
      )
    ).toBe(false);
  });

  test("keeps an event with no exception values", () => {
    expect(isScannerMultipartNoise({} as ErrorEvent)).toBe(false);
  });
});
