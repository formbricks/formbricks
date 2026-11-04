import { describe, expect, test } from "vitest";
import { buildCalBooking, buildCalBookingFromLegacyEvent, isCalBooked } from "./cal-booking";

describe("buildCalBooking", () => {
  test("stringifies every field Cal reports and marks the booking as booked", () => {
    expect(
      buildCalBooking({
        uid: "abc",
        title: "Intro call",
        startTime: "2026-11-05T10:00:00.000Z",
        endTime: "2026-11-05T10:30:00.000Z",
        eventTypeId: 42,
        status: "ACCEPTED",
        paymentRequired: false,
        isRecurring: true,
        videoCallUrl: "https://cal.com/video/abc",
      })
    ).toEqual({
      status: "booked",
      uid: "abc",
      title: "Intro call",
      startTime: "2026-11-05T10:00:00.000Z",
      endTime: "2026-11-05T10:30:00.000Z",
      eventTypeId: "42",
      bookingStatus: "ACCEPTED",
      paymentRequired: "false",
      isRecurring: "true",
      videoCallUrl: "https://cal.com/video/abc",
    });
  });

  test("leaves out fields Cal did not send", () => {
    expect(buildCalBooking({ uid: "abc", eventTypeId: null, title: "" })).toEqual({
      status: "booked",
      uid: "abc",
    });
  });

  test("still records a booking when the event carries no data", () => {
    expect(buildCalBooking(undefined)).toEqual({ status: "booked" });
  });
});

describe("buildCalBookingFromLegacyEvent", () => {
  test("derives the end from the start and the duration in minutes", () => {
    expect(buildCalBookingFromLegacyEvent({ date: "2026-11-05T10:00:00.000Z", duration: 30 })).toEqual({
      status: "booked",
      startTime: "2026-11-05T10:00:00.000Z",
      endTime: "2026-11-05T10:30:00.000Z",
    });
  });

  test("omits the end when the date is unparseable or the duration is missing", () => {
    expect(buildCalBookingFromLegacyEvent({ date: "not a date", duration: 30 })).toEqual({
      status: "booked",
      startTime: "not a date",
    });
    expect(buildCalBookingFromLegacyEvent({ date: "2026-11-05T10:00:00.000Z" })).toEqual({
      status: "booked",
      startTime: "2026-11-05T10:00:00.000Z",
    });
  });
});

describe("isCalBooked", () => {
  test.each([
    ["booked", true],
    [{ status: "booked", startTime: "2026-11-05T10:00:00.000Z" }, true],
    [{ status: "cancelled" }, false],
    [{ startTime: "2026-11-05T10:00:00.000Z" }, false],
    ["skipped", false],
    ["", false],
    [["booked"], false],
    [null, false],
    [undefined, false],
  ])("%j -> %s", (value, expected) => {
    expect(isCalBooked(value)).toBe(expected);
  });
});
