import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  DUPLICATE_RESPONSE_WINDOW_MS,
  findRecentDuplicateResponse,
  isDuplicateOfCandidate,
} from "./duplicate-response";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { response: { findMany: vi.fn() } },
}));

const surveyId = "cgt5e6dw1vsf1bv2ki5gj845";
const contactId = "clh8ruz3w0000qa8h9x0bt9ry";

describe("isDuplicateOfCandidate", () => {
  test("matches identical answers regardless of key order", () => {
    expect(
      isDuplicateOfCandidate(
        { id: "r1", data: { q1: 5, ticket: "T-1" }, finished: true },
        { data: { ticket: "T-1", q1: 5 }, finished: true }
      )
    ).toBe(true);
  });

  test("does not match a different answer or a different hidden field", () => {
    const candidate = { id: "r1", data: { q1: 5, ticket: "T-1" }, finished: false };

    expect(isDuplicateOfCandidate(candidate, { data: { q1: 4, ticket: "T-1" }, finished: false })).toBe(
      false
    );
    expect(isDuplicateOfCandidate(candidate, { data: { q1: 5, ticket: "T-2" }, finished: false })).toBe(
      false
    );
  });

  test("does not fold an unfinished submission into a finished response", () => {
    expect(
      isDuplicateOfCandidate(
        { id: "r1", data: { q1: 5 }, finished: true },
        { data: { q1: 5 }, finished: false }
      )
    ).toBe(false);
  });

  test("folds a finished submission into an unfinished response", () => {
    expect(
      isDuplicateOfCandidate(
        { id: "r1", data: { q1: 5 }, finished: false },
        { data: { q1: 5 }, finished: true }
      )
    ).toBe(true);
  });
});

describe("findRecentDuplicateResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("skips the lookup for an anonymous submission", async () => {
    const result = await findRecentDuplicateResponse({
      surveyId,
      contactId: null,
      data: { q1: 5 },
      finished: true,
    });

    expect(result).toBeNull();
    expect(prisma.response.findMany).not.toHaveBeenCalled();
  });

  test("returns the matching response from the contact's recent ones", async () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    vi.mocked(prisma.response.findMany).mockResolvedValue([
      { id: "other", data: { q1: 3 }, finished: true },
      { id: "match", data: { q1: 5 }, finished: true },
    ] as never);

    const result = await findRecentDuplicateResponse({
      surveyId,
      contactId,
      data: { q1: 5 },
      finished: true,
      now,
    });

    expect(result).toEqual({ id: "match" });
    expect(prisma.response.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          surveyId,
          contactId,
          createdAt: { gte: new Date(now.getTime() - DUPLICATE_RESPONSE_WINDOW_MS) },
        },
        take: 10,
      })
    );
  });

  test("returns null when no recent response matches", async () => {
    vi.mocked(prisma.response.findMany).mockResolvedValue([
      { id: "other", data: { q1: 3 }, finished: true },
    ] as never);

    const result = await findRecentDuplicateResponse({
      surveyId,
      contactId,
      data: { q1: 5 },
      finished: true,
    });

    expect(result).toBeNull();
  });
});
