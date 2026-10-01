import "server-only";
import { createHash } from "node:crypto";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { nativeAuthAuditContext } from "./native-auth-audit-context";

/** A 2FA challenge has verified a password but has no full session yet. Resolve only the signed,
 * unexpired server-side challenge; an email or userId in a request body is never a principal.
 */
export const captureTwoFactorAuditPrincipal = async (ctx: AuthHookContext): Promise<void> => {
  const audit = nativeAuthAuditContext.getStore();
  if (!audit) return;
  const body = ctx.body as Record<string, unknown> | undefined;
  if (
    audit.target &&
    ["/revoke-session", "/oauth2/revoke"].includes(ctx.path ?? "") &&
    typeof body?.token === "string"
  ) {
    audit.target.id = `sha256:${createHash("sha256").update(body.token).digest("hex")}`;
  }
  if (audit.target && typeof body?.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(body.id))
    audit.target.id = body.id;
  if (audit.actor.type !== "anonymous" || !ctx.path?.startsWith("/two-factor/verify-")) return;
  try {
    const cookie = ctx.context.createAuthCookie("two_factor");
    const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
    if (!identifier) return;
    const challenge = await ctx.context.internalAdapter.findVerificationValue(identifier);
    if (!challenge || new Date(challenge.expiresAt) <= new Date()) return;
    const user = await ctx.context.internalAdapter.findUserById(challenge.value);
    if (!user) return;
    audit.actor = { id: user.id, type: "user" };
    audit.authenticationStage = "password";
  } catch {
    audit.observationIncomplete = true;
  }
};
