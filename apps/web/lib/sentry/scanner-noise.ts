import type { ErrorEvent } from "@sentry/nextjs";

/**
 * The message undici raises when it cannot parse a multipart body. The two distinct causes we see in
 * production -- "missing boundary in content-type header" and "expected CRLF" -- both surface under
 * this one message, which is why they group as two Sentry issues that need the same treatment.
 */
const FORM_DATA_PARSE_FAILURE = "Failed to parse body as FormData";

/** Node's bundled undici, where the parse itself runs. */
const NODE_UNDICI_PREFIX = "node:internal/deps/undici";

const isNodeUndiciFrame = (frame: { filename?: string; abs_path?: string }): boolean =>
  (frame.filename ?? frame.abs_path ?? "").startsWith(NODE_UNDICI_PREFIX);

/**
 * Internet vulnerability scanners POST malformed multipart bodies at paths that match no route. The
 * body never reaches a handler -- undici fails to parse it first -- but the throw is still reported
 * as our own internal error, and at ~190 events/30d it is one of the larger sources of noise in the
 * project (ENG-1745, FORMBRICKS-K2 and FORMBRICKS-JX).
 *
 * The discriminator is the **stack**, not the route. `POST /_not-found/page` is the obvious scope and
 * it is the wrong one: route tags on this project are unreliable often enough that several unrelated
 * issues carry that same culprit, so scoping on it risks dropping a genuine upload failure whose tag
 * happened to be wrong. Every scanner event instead has a stack that is entirely inside undici with
 * no first-party frame at all, while a real `request.formData()` failure is reached from one of our
 * route handlers and carries its frame.
 *
 * So: the message has to appear, and *nothing anywhere in the chain* may sit outside undici. An event
 * with no stack at all is not evidence of a scanner either -- a parse failure we cannot place keeps
 * reporting, because being unable to attribute it is a reason to look, not a reason to drop it.
 */
export const isScannerMultipartNoise = (event: ErrorEvent): boolean => {
  const values = event.exception?.values;

  if (!values?.length) {
    return false;
  }

  if (!values.some((value) => value.value?.includes(FORM_DATA_PARSE_FAILURE))) {
    return false;
  }

  const frames = values.flatMap((value) => value.stacktrace?.frames ?? []);

  return frames.length > 0 && frames.every(isNodeUndiciFrame);
};
