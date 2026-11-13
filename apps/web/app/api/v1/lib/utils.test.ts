import { describe, expect, test } from "vitest";
import { TResponseInput } from "@formbricks/types/responses";
import { buildPrismaResponseData } from "./utils";

const input = (language?: string): TResponseInput =>
  ({ surveyId: "svy_1", finished: false, data: {}, language }) as unknown as TResponseInput;

describe("buildPrismaResponseData — language canonicalization (ENG-1067)", () => {
  test("canonicalizes a legacy language code", () => {
    expect(buildPrismaResponseData(input("hi"), null, {}).language).toBe("hi-IN");
  });

  test("leaves an already-canonical code unchanged", () => {
    expect(buildPrismaResponseData(input("hi-IN"), null, {}).language).toBe("hi-IN");
  });

  test("preserves the 'default' sentinel", () => {
    expect(buildPrismaResponseData(input("default"), null, {}).language).toBe("default");
  });

  test("preserves an unresolvable value", () => {
    expect(buildPrismaResponseData(input("123"), null, {}).language).toBe("123");
  });

  test("leaves undefined language as-is", () => {
    expect(buildPrismaResponseData(input(undefined), null, {}).language).toBeUndefined();
  });

  test("treats blank/whitespace-only language as absent (not persisted)", () => {
    expect(buildPrismaResponseData(input(""), null, {}).language).toBeUndefined();
    expect(buildPrismaResponseData(input("   "), null, {}).language).toBeUndefined();
  });
});

/**
 * ENG-1845. Omitted means "no ingest boundary ran", which has to leave the column alone — the
 * authenticated management create goes through this builder without running the contract. An empty
 * array is the other claim: the contract ran and found nothing, so a response is not left looking
 * like one nothing ever checked.
 */
describe("buildPrismaResponseData — Embedded Data ingest flags", () => {
  test("omits the column entirely when no contract ran", () => {
    expect(buildPrismaResponseData(input(), null, {})).not.toHaveProperty("ingestFlags");
  });

  test("writes an empty list when the contract ran and found nothing", () => {
    expect(buildPrismaResponseData(input(), null, {}, []).ingestFlags).toEqual([]);
  });

  test("writes the flags the contract computed", () => {
    expect(
      buildPrismaResponseData(input(), null, {}, [{ key: "seats", reason: "coercion_failed" }]).ingestFlags
    ).toEqual([{ key: "seats", reason: "coercion_failed" }]);
  });
});

/**
 * The details a Cal.com element reported go to their own column, set only by the client routes after they
 * split them out of `data` (`splitCalBookingsFromInput`). No booking means the column is left out, so a
 * create from the management routes, whose body schema has no such key, never writes it.
 */
describe("buildPrismaResponseData — Cal.com booking details", () => {
  const booking = { status: "booked", startTime: "2026-11-05T10:00:00.000Z" } as const;

  test("writes the bookings the route split out of data", () => {
    expect(
      buildPrismaResponseData({ ...input(), calBookings: { cal1: booking } }, null, {}).calBookings
    ).toEqual({
      cal1: booking,
    });
  });

  test("omits the column when there is no booking, or an empty set", () => {
    expect(buildPrismaResponseData(input(), null, {})).not.toHaveProperty("calBookings");
    expect(buildPrismaResponseData({ ...input(), calBookings: {} }, null, {})).not.toHaveProperty(
      "calBookings"
    );
  });
});
