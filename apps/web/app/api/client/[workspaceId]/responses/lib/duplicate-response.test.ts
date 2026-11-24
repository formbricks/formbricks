import { prisma } from "@/lib/__mocks__/database";
import { describe, expect, test, vi } from "vitest";
import {
  DUPLICATE_RESPONSE_WINDOW_MS,
  findRecentDuplicateResponse,
  isDuplicateOfCandidate,
} from "./duplicate-response";

vi.mock("server-only", () => ({}));

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
    const candidate = { id: "r1", data: { q1: 5, ticket: "T-1" }, finished: true };

    expect(isDuplicateOfCandidate(candidate, { data: { q1: 4, ticket: "T-1" }, finished: true })).toBe(false);
    expect(isDuplicateOfCandidate(candidate, { data: { q1: 5, ticket: "T-2" }, finished: true })).toBe(false);
  });

  test("does not fold an unfinished submission into a finished response", () => {
    expect(
      isDuplicateOfCandidate(
        { id: "r1", data: { q1: 5 }, finished: true },
        { data: { q1: 5 }, finished: false }
      )
    ).toBe(false);
  });

  test("does not fold into an unfinished response, whose id would let the caller edit it", () => {
    expect(
      isDuplicateOfCandidate(
        { id: "r1", data: { q1: 5 }, finished: false },
        { data: { q1: 5 }, finished: true }
      )
    ).toBe(false);
    expect(
      isDuplicateOfCandidate(
        { id: "r1", data: { q1: 5 }, finished: false },
        { data: { q1: 5 }, finished: false }
      )
    ).toBe(false);
  });
});

describe("findRecentDuplicateResponse", () => {
  test.each([
    { case: "an anonymous submission", surveyType: "link", contactId: null, finished: true },
    { case: "an app survey", surveyType: "app", contactId, finished: true },
    { case: "an unfinished submission", surveyType: "link", contactId, finished: false },
  ] as const)("skips the lookup for $case", async ({ surveyType, contactId, finished }) => {
    const result = await findRecentDuplicateResponse({
      surveyId,
      surveyType,
      contactId,
      data: { q1: 5 },
      finished,
    });

    expect(result).toBeNull();
    expect(prisma.response.findMany).not.toHaveBeenCalled();
  });

  describe("Cal booking details, which live outside `data`", () => {
    const stored = { cal1: { status: "booked", uid: "bk_1" } } as const;
    const other = { cal1: { status: "booked", uid: "bk_2" } } as const;
    const submit = (calBookings?: Record<string, { status: "booked"; uid: string }>) =>
      findRecentDuplicateResponse({
        surveyId,
        surveyType: "link",
        contactId,
        data: { cal1: "booked" },
        finished: true,
        calBookings,
      });

    test("folds a replay of the same booking into the response that kept it", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue([
        { id: "kept", data: { cal1: "booked" }, finished: true, calBookings: stored },
      ] as never);

      await expect(submit(stored)).resolves.toEqual({ id: "kept" });
    });

    test("never folds a different booking, or a booking into a response with none", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue([
        { id: "kept", data: { cal1: "booked" }, finished: true, calBookings: stored },
      ] as never);
      await expect(submit(other)).resolves.toBeNull();

      vi.mocked(prisma.response.findMany).mockResolvedValue([
        { id: "legacy", data: { cal1: "booked" }, finished: true, calBookings: null },
      ] as never);
      await expect(submit(stored)).resolves.toBeNull();
    });

    test("reads the stored bookings with the candidates", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue([] as never);

      await submit(stored);

      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.objectContaining({ calBookings: true }) })
      );
    });
  });

  test("returns the matching response from the contact's recent ones", async () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    vi.mocked(prisma.response.findMany).mockResolvedValue([
      { id: "other", data: { q1: 3 }, finished: true },
      { id: "match", data: { q1: 5 }, finished: true },
    ] as never);

    const result = await findRecentDuplicateResponse({
      surveyId,
      surveyType: "link",
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
          finished: true,
          createdAt: { gte: new Date(now.getTime() - DUPLICATE_RESPONSE_WINDOW_MS) },
          quotaLinks: { none: { status: "screenedOut" } },
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
      surveyType: "link",
      contactId,
      data: { q1: 5 },
      finished: true,
    });

    expect(result).toBeNull();
  });
});
