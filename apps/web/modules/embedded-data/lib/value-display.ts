/**
 * The text an analysis surface shows for one stored Embedded Data value (ENG-3266).
 *
 * The value half of `labelEmbeddedFields`' label half, and for the same reason: every surface that
 * reads a field's stored value had its own inline expression, all written as
 * `typeof value === "string"`. That was true while every ingested field was a hidden field and hidden
 * fields were text. Typed fields make it false — a `number` field stores a JSON number, so a value
 * the product accepted, stored and exports rendered as nothing.
 *
 * **Deliberately not `resolveEmbeddedValue`.** That resolver has a default tier this does not: it
 * substitutes a locked field's `defaultValue`, which would change what already-stored responses
 * display. This only widens "what counts as showable", and nothing else.
 *
 * The `boolean` arm is defensive, not a fix. `ZResponseDataValue` has no boolean member, so a
 * boolean-typed field is stored as the string `"true"` / `"false"` and already displayed — see the
 * note on `normalizeBoolean` in `@formbricks/types/embedded-data-ingest`, where widening the read
 * seam to a fourth value shape was considered and rejected. `number` is the arm that fixes a bug.
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
