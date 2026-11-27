import "server-only";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";

/**
 * ENG-7311: OAuth credentials of the Slack, Google Sheets and Airtable integrations are encrypted at rest
 * with the same helper the Notion callback uses (`symmetricEncrypt` / `ENCRYPTION_KEY`).
 *
 * Notion is deliberately not listed: it has always stored an encrypted `access_token` and decrypts it
 * itself in `lib/notion/service.ts`, so handling it here as well would decrypt twice.
 *
 * The layer is read-tolerant. Rows written before this change (and rows an older pod writes during a
 * rolling upgrade) hold plaintext tokens, and they keep working: a value is decrypted only when it has
 * the shape `symmetricEncrypt` produces, and encrypted only when it does not.
 */
const ENCRYPTED_INTEGRATION_TYPES: ReadonlySet<string> = new Set(["slack", "googleSheets", "airtable"]);

/** The `config.key` fields that are credentials. Everything else in `key` (scope, team, expiry) is metadata. */
const CREDENTIAL_FIELDS = ["access_token", "refresh_token"] as const;

/** `symmetricEncrypt` output: `<16-byte iv hex>:<ciphertext hex>:<16-byte GCM tag hex>`. */
const ENCRYPTED_VALUE_PATTERN = /^[0-9a-f]{32}:[0-9a-f]*:[0-9a-f]{32}$/;

/** A real provider token is never in this shape, so it tells our own ciphertext from a legacy plaintext token. */
export const isEncryptedCredential = (value: string): boolean => ENCRYPTED_VALUE_PATTERN.test(value);

type TIntegrationConfigLike = { key?: unknown } | null | undefined;

const mapCredentialFields = (
  config: TIntegrationConfigLike,
  transform: (value: string) => string
): TIntegrationConfigLike => {
  const key = config?.key;
  if (!config || !key || typeof key !== "object") return config;

  const nextKey: Record<string, unknown> = { ...(key as Record<string, unknown>) };
  for (const field of CREDENTIAL_FIELDS) {
    const value = nextKey[field];
    // An empty string is "no token" (Google Sheets reports that as the reconnect case): leave it as it is.
    if (typeof value === "string" && value !== "") nextKey[field] = transform(value);
  }
  return { ...config, key: nextKey };
};

const encryptIfPlain = (value: string): string =>
  isEncryptedCredential(value) ? value : symmetricEncrypt(value, ENCRYPTION_KEY);

/**
 * A credential that is our ciphertext but no longer decrypts (`ENCRYPTION_KEY` changed, row corrupted) comes
 * back as "", the value the integrations already treat as "no token, reconnect", never as garbage. Throwing
 * instead would fail every read of the workspace's integrations, hiding the healthy ones from the response
 * pipeline and making the broken one impossible to reconnect (each OAuth callback reads the stored row first).
 */
const decryptIfEncrypted = (value: string, onUndecryptable: () => void): string => {
  if (!isEncryptedCredential(value)) return value;
  try {
    return symmetricDecrypt(value, ENCRYPTION_KEY);
  } catch {
    onUndecryptable();
    return "";
  }
};

export const hasEncryptedCredentials = (type: string): boolean => ENCRYPTED_INTEGRATION_TYPES.has(type);

/** The `config` to persist: credentials encrypted, idempotent on an already-encrypted value. */
export const encryptIntegrationConfig = <T extends TIntegrationConfigLike>(type: string, config: T): T =>
  hasEncryptedCredentials(type) ? (mapCredentialFields(config, encryptIfPlain) as T) : config;

/**
 * The `config` to use in memory: credentials decrypted, legacy plaintext passed through, and a credential
 * that no longer decrypts blanked to "" (see {@link decryptIfEncrypted}). `onUndecryptable` is called once
 * per blanked field so the caller can log which integration needs reconnecting.
 */
export const decryptIntegrationConfig = <T extends TIntegrationConfigLike>(
  type: string,
  config: T,
  onUndecryptable: () => void = () => {}
): T =>
  hasEncryptedCredentials(type)
    ? (mapCredentialFields(config, (value) => decryptIfEncrypted(value, onUndecryptable)) as T)
    : config;
