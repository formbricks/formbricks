import "server-only";
import { createRequestStateCodec } from "@modelcontextprotocol/server";
import { hkdfSync } from "node:crypto";
import { ENCRYPTION_KEY } from "@/lib/constants";

/**
 * The HMAC key for multi-round-trip `requestState`, derived rather than reused.
 *
 * `requestState` round-trips through the client and comes back as attacker-controlled input, so the
 * protocol puts integrity protection on the server author. The SDK ships the codec; what it cannot
 * supply is a key.
 *
 * Derived from `ENCRYPTION_KEY` with HKDF and a fixed `info` label rather than using that value
 * directly. Two reasons, and neither is ceremony: a key used for two purposes lets a weakness in one
 * reach the other, and a self-hoster should not have to set a second secret to get a working delete
 * confirmation. Every instance derives the same subkey from the same input, which is what lets one
 * replica mint a state another verifies.
 *
 * The codec requires at least 32 bytes and HKDF-SHA256 gives exactly that.
 */
const MCP_REQUEST_STATE_INFO = "formbricks.mcp.requestState.v1";

const deriveRequestStateKey = (): Uint8Array =>
  new Uint8Array(hkdfSync("sha256", ENCRYPTION_KEY, "", MCP_REQUEST_STATE_INFO, 32));

/** What a pending confirmation remembers between the two rounds of a delete. */
export type TMcpConfirmationState = {
  /** The tool that minted it, so one tool's confirmation cannot be replayed at another. */
  tool: string;
  /** The exact resource the user was asked about. Checked against the retry's arguments. */
  resourceId: string;
};

/**
 * `bind` ties a minted state to the principal and the method it was minted for, so a state one
 * caller holds cannot be echoed by another. The binding value is HMAC'd into a tag rather than
 * stored, so the client never sees what it was bound to.
 *
 * `authInfo.token` is the principal identifier the auth layer already derives — the API key's id, or
 * `oauth:<userId>:<clientId>` for a token — so it covers both auth methods and both the user and the
 * client. It is read off the verified `authInfo`, never off the request.
 *
 * Deliberately NOT bound to the request id: that is minted per HTTP request, so the two rounds of a
 * confirmation carry different ones and every verification would fail.
 */
export const mcpRequestStateCodec = createRequestStateCodec<TMcpConfirmationState>({
  key: deriveRequestStateKey(),
  // Long enough for a person to read a confirmation prompt and answer it, short enough that a state
  // captured from a log is useless by the time it is found.
  ttlSeconds: 300,
  bind: (ctx) => {
    const authInfo = ctx.http?.authInfo;
    return [ctx.mcpReq?.method ?? "", authInfo?.token ?? ""].join("\u0000");
  },
});
