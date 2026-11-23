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
import { zPostgresText } from "@/lib/utils/postgres-text";

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
export type TCalBookingSplit = {
  data: TResponseData | undefined;
  calBookings: TCalBookingsByQuestionId | undefined;
  /** The Cal element whose booking holds a value Postgres cannot store; the caller answers 400. */
  invalidElementId?: string;
};

const isPostgresSafe = (booking: Record<string, string>) =>
  Object.values(booking).every((value) => zPostgresText().safeParse(value).success);

export const extractCalBookings = (
  survey: Pick<TSurvey, "blocks">,
  data: TResponseData | undefined
): TCalBookingSplit => {
  if (!data) return { data, calBookings: undefined };

  // Null-prototype, because an element id only has to satisfy the legacy id charset, which admits
  // `__proto__`: on a plain object that key would hit the prototype setter instead of becoming a key.
  const nextData = Object.assign(Object.create(null), data) as TResponseData;
  const bookings = Object.create(null) as TCalBookingsByQuestionId;
  let found = false;

  for (const element of getElementsFromBlocks(survey.blocks)) {
    if (element.type !== TSurveyElementTypeEnum.Cal) continue;
    const booking = sanitizeCalBooking(data[element.id]);
    if (!booking) continue;
    // A NUL byte fails the whole write with a 500, so it is refused here with the other bad input.
    if (!isPostgresSafe(booking)) return { data, calBookings: undefined, invalidElementId: element.id };
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
): { invalidElementId?: string } => {
  const { data, calBookings, invalidElementId } = extractCalBookings(survey, input.data);
  if (invalidElementId) return { invalidElementId };
  if (data) input.data = data;
  if (calBookings) input.calBookings = calBookings;
  else delete input.calBookings;
  return {};
};

/**
 * The bookings whose answer in `data` is still the string "booked". Run after the not-shown filter removed
 * the answers of questions the respondent was not shown, and on every write that replaces `data`, so a
 * booking never outlives the answer it belongs to.
 */
export const calBookingsForAnswers = (
  calBookings: TCalBookingsByQuestionId | null | undefined,
  data: TResponseData
): TCalBookingsByQuestionId =>
  Object.fromEntries(
    Object.entries(calBookings ?? {}).filter(([elementId]) => data[elementId] === CAL_BOOKED_STATUS)
  );
