import {
  CAL_BOOKED_STATUS,
  type TCalBookingsByQuestionId,
  type TWithCalBookings,
  sanitizeCalBooking,
} from "@formbricks/types/cal-booking";
import { type TResponseData } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/lib/survey/utils";

/**
 * The survey renderer holds a Cal element's full booking record as its value and sends it in `data`. What
 * is stored is different: `data[questionId]` stays the string "booked", exactly as before the booking
 * details existed, and the record moves to `Response.calBookings`. That keeps every reader of `data`
 * (webhooks, the v1 and v2 APIs, exports, integrations, filters, logic) unchanged.
 *
 * Only keys of the survey's own Cal elements are looked at, and only a value whose `status` is "booked" is
 * taken as a booking, cut down to the known fields. Any other value, including a record that is not a
 * booking, is left exactly as it arrived. A renderer from before this change sends the string "booked",
 * which passes through, so such a response simply has no details.
 */
export const extractCalBookings = (
  survey: Pick<TSurvey, "blocks">,
  data: TResponseData | undefined
): { data: TResponseData | undefined; calBookings: TCalBookingsByQuestionId | undefined } => {
  if (!data) return { data, calBookings: undefined };

  // Null-prototype, because an element id only has to satisfy the legacy id charset, which admits
  // `__proto__`: on a plain object that key would hit the prototype setter instead of becoming a key.
  const nextData = Object.assign(Object.create(null), data) as TResponseData;
  const bookings = Object.create(null) as TCalBookingsByQuestionId;
  let found = false;

  for (const element of getElementsFromBlocks(survey.blocks as TSurvey["blocks"])) {
    if (element.type !== TSurveyElementTypeEnum.Cal) continue;
    const booking = sanitizeCalBooking(data[element.id]);
    if (!booking) continue;
    bookings[element.id] = booking;
    nextData[element.id] = CAL_BOOKED_STATUS;
    found = true;
  }

  return { data: { ...nextData }, calBookings: found ? { ...bookings } : undefined };
};

/**
 * Applies `extractCalBookings` to a response input in place, as the routes do with the ingest contract's
 * `data`: afterwards `input.data` holds "booked" and `input.calBookings` the details, or is unset when
 * there are none. Run it after the ingest contract and before validation, quota evaluation and the
 * duplicate fold, so each of them sees the value that will be stored.
 */
export const splitCalBookingsFromInput = (
  survey: Pick<TSurvey, "blocks">,
  input: { data?: TResponseData } & TWithCalBookings
): void => {
  const { data, calBookings } = extractCalBookings(survey, input.data);
  if (data) input.data = data;
  if (calBookings) input.calBookings = calBookings;
  else delete input.calBookings;
};
