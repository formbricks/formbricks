/**
 * The text an analysis surface shows for one stored Embedded Data value (ENG-3266).
 *
 * The value half of {@link getReservedFieldLabel}'s label half, and for the same reason: the response
 * table, the summary and the single-response card each had their own inline expression, all three
 * written as `typeof value === "string"`. That was true while every ingested field was a hidden field
 * and hidden fields were text. Typed fields make it false — a `number` field stores a JSON number, so
 * a value the product accepted, stored and exports rendered as nothing on all three.
 *
 * **Deliberately not {@link resolveEmbeddedValue}.** That resolver has coercion and default tiers
 * this does not: it substitutes a locked field's `defaultValue` and re-reads reserved fields, which
 * would change what already-stored responses display. This only widens "what counts as showable" from
 * strings to every JSON scalar, and nothing else.
 *
 * `null` means there is nothing to show, which is not the same as the empty string: a stored `""` is a
 * present value and stays one, so a caller that skips blanks keeps skipping exactly what it did.
 * Arrays and records are `null` too — `response.data` is shared with element answers, so a
 * multi-select array under a field's storage key means the key collided with an element id, and
 * joining it would invent a value the respondent never gave for this field.
 */
export const displayEmbeddedValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return String(value);

  return null;
};
