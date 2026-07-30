import { z } from "zod";

const ZLiteralEmail = z.email();

/**
 * Whether a `send_email` `to` value is a literal email address rather than a survey element id that
 * resolves against the response at send time. Literal recipients are author-chosen and must be
 * checked against the organization allowlist (ENG-2029); an element-id `to` resolves to the
 * respondent's own address and is exempt. Shared by the enable-time gate (workflows handlers) and
 * the send-time backstop (app runner) so the two classifications cannot drift.
 */
export const isLiteralEmailRecipient = (to: string): boolean => ZLiteralEmail.safeParse(to).success;
