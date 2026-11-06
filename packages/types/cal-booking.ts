/**
 * What the Cal.com element stores as its response value.
 *
 * Before 6.2 this was the literal string "booked". It is now a flat record of the booking the embed
 * reported, so the response (and the webhook that carries `response.data`) knows when the meeting is.
 * Old responses keep the string, so every reader goes through `isCalBooked` rather than comparing.
 *
 * The record is `Record<string, string>` because that is what a response value can hold; booleans are
 * stringified ("true" / "false") and absent fields are left out.
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

/** True for a booked Cal response value, in its legacy string form or the booking record. */
export const isCalBooked = (value: unknown): boolean => {
  if (value === CAL_BOOKED_STATUS) return true;
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).status === CAL_BOOKED_STATUS
  );
};
