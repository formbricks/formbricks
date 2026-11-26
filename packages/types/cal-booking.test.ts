import { describe, expect, test } from "vitest";
import {
  MAX_CAL_BOOKING_VALUE_LENGTH,
  buildCalBooking,
  buildCalBookingFromLegacyEvent,
  sanitizeCalBooking,
} from "./cal-booking";

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

describe("sanitizeCalBooking", () => {
  test("keeps a booking record and its known string fields", () => {
    const booking = {
      status: "booked",
      uid: "abc",
      title: "Intro call",
      startTime: "2026-11-05T10:00:00.000Z",
      endTime: "2026-11-05T10:30:00.000Z",
      eventTypeId: "42",
      bookingStatus: "ACCEPTED",
      paymentRequired: "false",
      isRecurring: "false",
      videoCallUrl: "https://cal.com/video/abc",
    };

    expect(sanitizeCalBooking(booking)).toEqual(booking);
  });

  test("drops unknown keys, non-string values and empty strings", () => {
    expect(sanitizeCalBooking({ status: "booked", extra: "x", uid: 5, title: "", startTime: "t" })).toEqual({
      status: "booked",
      startTime: "t",
    });
  });

  test("cuts a value past the cap instead of refusing the booking", () => {
    const result = sanitizeCalBooking({
      status: "booked",
      title: "t".repeat(MAX_CAL_BOOKING_VALUE_LENGTH + 1),
    });

    expect(result?.title).toHaveLength(MAX_CAL_BOOKING_VALUE_LENGTH);
  });

  test.each([
    ["the legacy string", "booked"],
    ["a record that is not booked", { status: "cancelled" }],
    ["a record without a status", { startTime: "2026-11-05T10:00:00.000Z" }],
    ["an array", ["booked"]],
    ["an empty string", ""],
    ["null", null],
    ["undefined", undefined],
  ])("is not a booking: %s", (_label, value) => {
    expect(sanitizeCalBooking(value)).toBeNull();
  });
});
