-- ENG-2343: Better Auth 1.7 resource model + account identity.
--
-- Two halves. Everything here is derivable without knowing the deployment's URLs. The rest — seeding
-- the oauthResource row and linking existing clients/tokens/consents to it — needs
-- `${WEBAPP_URL}/api/mcp`, which SQL cannot know, so it lives in the sibling data migration
-- 20260812110001_eng_2343_backfill_oauth_resource_links.
--
-- The Account.issuer backfill below is NOT optional and NOT cosmetic. Better Auth 1.7 keys accounts on
-- (issuer, accountId) and filters every lookup on it, including findCredentialAccount (password
-- sign-in) and updatePassword (password reset). Shipping 1.7 against rows with a null issuer locks
-- every user out of password login, and their password reset silently matches zero rows.

-- AlterTable
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "applicationType" TEXT,
ADD COLUMN IF NOT EXISTS "backchannelLogoutSessionRequired" BOOLEAN,
ADD COLUMN IF NOT EXISTS "backchannelLogoutUri" TEXT,
ADD COLUMN IF NOT EXISTS "clientCredentialsScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "clientDiscoveryId" TEXT,
ADD COLUMN IF NOT EXISTS "dpopBoundAccessTokens" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "jwks" TEXT,
ADD COLUMN IF NOT EXISTS "jwksUri" TEXT;

-- AlterTable
ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "authorizationCodeId" TEXT,
ADD COLUMN IF NOT EXISTS "confirmation" JSONB,
ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "revoked" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "authorizationCodeId" TEXT,
ADD COLUMN IF NOT EXISTS "confirmation" JSONB,
ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rotationReplayExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rotationReplayResponse" TEXT;

-- AlterTable
ALTER TABLE "oauthConsent" ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "resources" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauthResource" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessTokenTtl" INTEGER,
    "refreshTokenTtl" INTEGER,
    "signingAlgorithm" TEXT,
    "signingKeyId" TEXT,
    "allowedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customClaims" JSONB,
    "dpopBoundAccessTokensRequired" BOOLEAN DEFAULT false,
    "disabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "policyVersion" INTEGER DEFAULT 1,
    "metadata" JSONB,

    CONSTRAINT "oauthResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauthClientResource" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3),

    CONSTRAINT "oauthClientResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauthClientAssertion" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauthClientAssertion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauthResource_identifier_key" ON "oauthResource"("identifier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauthClientResource_resourceId_idx" ON "oauthClientResource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauthClientResource_clientId_resourceId_key" ON "oauthClientResource"("clientId", "resourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauthClientAssertion_expiresAt_idx" ON "oauthClientAssertion"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauthAccessToken_authorizationCodeId_idx" ON "oauthAccessToken"("authorizationCodeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauthRefreshToken_authorizationCodeId_idx" ON "oauthRefreshToken"("authorizationCodeId");

-- AddForeignKey
-- Guarded with DO/EXCEPTION rather than IF NOT EXISTS: Postgres has no IF NOT EXISTS for
-- ADD CONSTRAINT, and this migration must stay convergent against a database created with `db:push`,
-- where these constraints already exist.
DO $$
BEGIN
  ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "oauthResource"("identifier") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- JWT signing keyring (Better Auth 1.7)
-- ---------------------------------------------------------------------------

-- Not cosmetic, despite both being declared `required: false` upstream. `createJwk`
-- (better-auth/plugins/jwt/utils) always puts `alg` in the row it writes — defaulting to EdDSA — and
-- adds `crv` whenever it can derive one, which it can for the default EdDSA/Ed25519 keyring we run.
-- Without these columns Prisma rejects that INSERT as an unknown argument, so the first key mint
-- fails, and with it JWT signing and the whole MCP OAuth flow. It surfaces only against a real
-- database on a deployment that has not minted a key yet (a fresh self-host, or after rotation) —
-- mocked unit tests and the in-memory DCR harness both write nothing here.
--
-- Nullable because rows written before 1.7 carry no value, and upstream reads are explicit about it:
-- getLatestKeyByAlg treats `alg: null` as the configured default alg, so keys already in the table
-- keep signing without a backfill.
ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "alg" TEXT,
ADD COLUMN IF NOT EXISTS "crv" TEXT;

COMMENT ON COLUMN "jwks"."alg" IS 'JWS algorithm for this key. NULL on pre-1.7 rows, read as the configured default alg.';
COMMENT ON COLUMN "jwks"."crv" IS 'Curve for EC/OKP keys (Ed25519 under the default keyring).';

-- ---------------------------------------------------------------------------
-- Account identity (Better Auth 1.7)
-- ---------------------------------------------------------------------------

-- Nullable on purpose, although better-auth declares `issuer` required: a NOT NULL column would fail
-- every INSERT from a 1.6 pod still serving during a rolling deploy.
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "issuer" TEXT;

-- Backfill BEFORE the unique index, so a collision fails the migration here rather than surfacing as
-- a login bug later. Values mirror better-auth's own helpers (@better-auth/core db/schema/account):
--   createLocalAccountIssuer(id) => `local:${encodeURIComponent(id)}`        -- credential accounts
--   createOAuthAccountIssuer(id) => `local:oauth:${encodeURIComponent(id)}`  -- every OAuth provider
-- encodeURIComponent is the identity function for all provider ids in use here (credential, github,
-- google, azuread, openid, saml), so plain concatenation matches byte for byte. A provider id that
-- ever needs escaping must be added to this expression deliberately.
--
-- This pairs with `accountIssuer` being pinned explicitly on the generic providers in
-- better-auth-providers.ts. Without that pin, discovery providers would derive a tenant-specific
-- issuer URL that no portable backfill could reproduce.
--
-- One provider is NOT synthetic. A built-in social provider may declare its own `accountIssuer`, and
-- Better Auth then keys accounts on that instead of the local: form. Verified against
-- @better-auth/core/dist/social-providers for the two we enable:
--   google -> accountIssuer "https://accounts.google.com"  (declared upstream)
--   github -> none declared, so the local:oauth: fallback applies
-- Getting google wrong would leave every existing Google user unmatched at sign-in. Any future
-- built-in social provider must be checked the same way before it is enabled.
UPDATE "Account"
SET "issuer" = CASE
  WHEN "provider" = 'credential' THEN 'local:credential'
  WHEN "provider" = 'google' THEN 'https://accounts.google.com'
  ELSE 'local:oauth:' || "provider"
END
WHERE "issuer" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Account_issuer_providerAccountId_key" ON "Account"("issuer", "providerAccountId");

COMMENT ON COLUMN "Account"."issuer" IS 'Better Auth 1.7 account identity namespace; half of the (issuer, accountId) key. Backfilled by ENG-2343.';
COMMENT ON COLUMN "oauthAccessToken"."resources" IS 'RFC 8707 resource indicators this token was approved for (GHSA-p2fr-6hmx-4528).';
COMMENT ON COLUMN "oauthRefreshToken"."resources" IS 'Full original resource grant; a refresh may narrow this set but never widen it.';
COMMENT ON COLUMN "oauthConsent"."resources" IS 'Resources the user consented to; /authorize compares requested resources against these.';
COMMENT ON TABLE "oauthResource" IS 'Protected resources the AS issues tokens for. Seeded from the oauthProvider `resources` option.';
COMMENT ON TABLE "oauthClientResource" IS 'Client-to-resource grants. With enforcePerClientResources a missing row means invalid_target.';
