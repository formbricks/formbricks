import { describe, expect, test } from "vitest";
import { MAX_CAL_BOOKING_VALUE_LENGTH } from "@formbricks/types/cal-booking";
import { type TResponseData } from "@formbricks/types/responses";
import { extractCalBookings, splitCalBookingsFromInput } from "./cal-bookings";

const survey = {
  blocks: [
    {
      id: "b1",
      name: "Block 1",
      elements: [
        { id: "cal1", type: "cal", headline: { default: "Book" }, required: false, calUserName: "x" },
        { id: "cal2", type: "cal", headline: { default: "Book again" }, required: false, calUserName: "x" },
        { id: "matrix1", type: "matrix", headline: { default: "Matrix" }, required: false },
        { id: "text1", type: "openText", headline: { default: "Text" }, required: false },
      ],
    },
  ],
} as never;

const booking = {
  status: "booked",
  uid: "abc",
  title: "Intro call",
  startTime: "2026-11-05T10:00:00.000Z",
  endTime: "2026-11-05T10:30:00.000Z",
};

describe("extractCalBookings", () => {
  test("moves a booking record out of data and leaves the string 'booked' behind", () => {
    const result = extractCalBookings(survey, { cal1: booking, text1: "hello" });

    expect(result.data).toEqual({ cal1: "booked", text1: "hello" });
    expect(result.calBookings).toEqual({ cal1: booking });
  });

  test("handles several Cal questions independently", () => {
    const result = extractCalBookings(survey, { cal1: booking, cal2: "booked" });

    expect(result.data).toEqual({ cal1: "booked", cal2: "booked" });
    expect(result.calBookings).toEqual({ cal1: booking });
  });

  test("passes the legacy string through with no details", () => {
    const result = extractCalBookings(survey, { cal1: "booked" });

    expect(result.data).toEqual({ cal1: "booked" });
    expect(result.calBookings).toBeUndefined();
  });

  test("leaves a record that is not a booking exactly as it arrived", () => {
    const notBooked = { status: "cancelled", title: "x" };
    const result = extractCalBookings(survey, { cal1: notBooked });

    expect(result.data).toEqual({ cal1: notBooked });
    expect(result.calBookings).toBeUndefined();
  });

  test("never reads a booking out of a question that is not a Cal element", () => {
    // A matrix answer is a Record<string, string> too; one that looks like a booking must stay a matrix.
    const lookalike = { status: "booked" };
    const result = extractCalBookings(survey, { matrix1: lookalike, text1: "booked" });

    expect(result.data).toEqual({ matrix1: lookalike, text1: "booked" });
    expect(result.calBookings).toBeUndefined();
  });

  test("keeps only the known fields, as strings, and caps their length", () => {
    const result = extractCalBookings(survey, {
      cal1: {
        status: "booked",
        title: "t".repeat(MAX_CAL_BOOKING_VALUE_LENGTH + 500),
        injected: "nope",
        uid: 42,
        videoCallUrl: "",
      } as unknown as Record<string, string>,
    });

    expect(result.calBookings).toEqual({
      cal1: { status: "booked", title: "t".repeat(MAX_CAL_BOOKING_VALUE_LENGTH) },
    });
  });

  test("does not change the input", () => {
    const data: TResponseData = { cal1: booking };
    extractCalBookings(survey, data);

    expect(data).toEqual({ cal1: booking });
  });

  test("absent data stays absent (a partial update)", () => {
    expect(extractCalBookings(survey, undefined)).toEqual({ data: undefined, calBookings: undefined });
  });
});

describe("splitCalBookingsFromInput", () => {
  test("sets data and calBookings on the input", () => {
    const input: { data?: TResponseData; calBookings?: Record<string, unknown> } = {
      data: { cal1: booking },
    };
    splitCalBookingsFromInput(survey, input as never);

    expect(input.data).toEqual({ cal1: "booked" });
    expect(input.calBookings).toEqual({ cal1: booking });
  });

  test("clears a calBookings value that was already on the input when there is nothing to store", () => {
    const input = { data: { cal1: "booked" }, calBookings: { cal1: booking } };
    splitCalBookingsFromInput(survey, input as never);

    expect(input.calBookings).toBeUndefined();
  });
});
