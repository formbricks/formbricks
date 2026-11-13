/**
 * Booking details of a Cal.com element.
 *
 * The element's answer in `response.data` stays the literal string "booked", so every reader of `data`
 * (webhooks, the v1 and v2 APIs, exports, integrations, filters, logic) keeps working unchanged. The
 * details Cal reported (start and end time, title, ...) live beside it, keyed by the element's Question ID,
 * in `Response.calBookings`.
 *
 * The survey renderer still holds the full record as the element's value while the respondent is in the
 * survey and sends it inside `data`; the server splits it out (`extractCalBookings`) before anything is
 * stored. The record is `Record<string, string>` because that is what a response value can hold: booleans
 * are stringified ("true" / "false") and absent fields are left out.
 */
export const CAL_BOOKED_STATUS = "booked";

export type TCalBooking = {
  status: typeof CAL_BOOKED_STATUS;
  uid?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  eventTypeId?: string;
  /** Cal's own booking status ("ACCEPTED", "PENDING", ...), not to be confused with `status`. */
  bookingStatus?: string;
  paymentRequired?: string;
  isRecurring?: string;
  videoCallUrl?: string;
};

/** `{ [Question ID]: booking }`, as stored in `Response.calBookings` and sent in webhooks. */
export type TCalBookingsByQuestionId = Record<string, TCalBooking>;

/**
 * Bookings the server pulled out of a response's `data`, carried beside the input that holds the rest.
 * Deliberately not part of `ZResponseInput` / `ZResponseUpdateInput`: the routes derive it from the survey
 * and the incoming data, so a body that names it is stripped by the parse and can never reach the column.
 */
export type TWithCalBookings = { calBookings?: TCalBookingsByQuestionId };

/** The booking fields Cal's `bookingSuccessfulV2` event carries. */
export type TCalBookingEventData = {
  uid?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  eventTypeId?: number | null;
  status?: string;
  paymentRequired?: boolean;
  isRecurring?: boolean;
  videoCallUrl?: string;
};

/** The booking fields of the deprecated `bookingSuccessful` event, the only one an older Cal host emits. */
export type TCalLegacyBookingEventData = {
  date?: string;
  duration?: number;
};

const setIfPresent = (
  target: Record<string, string>,
  key: string,
  value: string | number | boolean | null | undefined
): void => {
  if (value === undefined || value === null || value === "") return;
  target[key] = String(value);
};

export const buildCalBooking = (data: TCalBookingEventData | undefined): TCalBooking => {
  const booking: Record<string, string> = { status: CAL_BOOKED_STATUS };
  setIfPresent(booking, "uid", data?.uid);
  setIfPresent(booking, "title", data?.title);
  setIfPresent(booking, "startTime", data?.startTime);
  setIfPresent(booking, "endTime", data?.endTime);
  setIfPresent(booking, "eventTypeId", data?.eventTypeId);
  setIfPresent(booking, "bookingStatus", data?.status);
  setIfPresent(booking, "paymentRequired", data?.paymentRequired);
  setIfPresent(booking, "isRecurring", data?.isRecurring);
  setIfPresent(booking, "videoCallUrl", data?.videoCallUrl);
  return booking as TCalBooking;
};

/**
 * Fallback for a Cal host too old to emit `bookingSuccessfulV2`: all that event gives us is the start
 * and, as a duration in minutes, the length.
 */
export const buildCalBookingFromLegacyEvent = (data: TCalLegacyBookingEventData | undefined): TCalBooking => {
  const booking = buildCalBooking({ startTime: data?.date });
  if (data?.date && typeof data.duration === "number") {
    const start = new Date(data.date);
    if (!Number.isNaN(start.getTime())) {
      booking.endTime = new Date(start.getTime() + data.duration * 60_000).toISOString();
    }
  }
  return booking;
};

/** The keys of a stored booking besides `status`. Anything else a client sends is dropped. */
const CAL_BOOKING_DETAIL_KEYS = [
  "uid",
  "title",
  "startTime",
  "endTime",
  "eventTypeId",
  "bookingStatus",
  "paymentRequired",
  "isRecurring",
  "videoCallUrl",
] as const;

/**
 * Longest value kept for one booking field. Generous: far above a real title or join link, yet it stops a
 * hostile client from storing megabytes per field. A longer value is cut rather than refused, so a real
 * submission is never rejected over a verbose title.
 */
export const MAX_CAL_BOOKING_VALUE_LENGTH = 2000;

/**
 * The booking a client sent as a Cal element's value, cut down to what is stored: only the known string
 * fields, each capped. `null` when the value is not a booking record (`status` must be "booked"), in which
 * case the caller leaves the value alone.
 *
 * The record comes from the respondent's browser, so it is as trustworthy as any other answer: a
 * respondent can send any of these fields.
 */
export const sanitizeCalBooking = (value: unknown): TCalBooking | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.status !== CAL_BOOKED_STATUS) return null;

  const booking: Record<string, string> = { status: CAL_BOOKED_STATUS };
  for (const key of CAL_BOOKING_DETAIL_KEYS) {
    const detail = record[key];
    if (typeof detail === "string" && detail !== "") {
      booking[key] = detail.slice(0, MAX_CAL_BOOKING_VALUE_LENGTH);
    }
  }
  return booking as TCalBooking;
};
