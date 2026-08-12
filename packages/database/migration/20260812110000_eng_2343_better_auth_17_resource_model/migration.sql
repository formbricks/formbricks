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
ALTER TABLE "oauthClient" ADD COLUMN     "applicationType" TEXT,
ADD COLUMN     "backchannelLogoutSessionRequired" BOOLEAN,
ADD COLUMN     "backchannelLogoutUri" TEXT,
ADD COLUMN     "clientCredentialsScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "clientDiscoveryId" TEXT,
ADD COLUMN     "dpopBoundAccessTokens" BOOLEAN DEFAULT false,
ADD COLUMN     "jwks" TEXT,
ADD COLUMN     "jwksUri" TEXT;

-- AlterTable
ALTER TABLE "oauthAccessToken" ADD COLUMN     "authorizationCodeId" TEXT,
ADD COLUMN     "confirmation" JSONB,
ADD COLUMN     "requestedUserInfoClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "revoked" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "oauthRefreshToken" ADD COLUMN     "authorizationCodeId" TEXT,
ADD COLUMN     "confirmation" JSONB,
ADD COLUMN     "requestedUserInfoClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rotatedAt" TIMESTAMP(3),
ADD COLUMN     "rotationReplayExpiresAt" TIMESTAMP(3),
ADD COLUMN     "rotationReplayResponse" TEXT;

-- AlterTable
ALTER TABLE "oauthConsent" ADD COLUMN     "requestedUserInfoClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resources" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "oauthResource" (
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
CREATE TABLE "oauthClientResource" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3),

    CONSTRAINT "oauthClientResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauthClientAssertion" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauthClientAssertion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauthResource_identifier_key" ON "oauthResource"("identifier");

-- CreateIndex
CREATE INDEX "oauthClientResource_clientId_idx" ON "oauthClientResource"("clientId");

-- CreateIndex
CREATE INDEX "oauthClientResource_resourceId_idx" ON "oauthClientResource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "oauthClientResource_clientId_resourceId_key" ON "oauthClientResource"("clientId", "resourceId");

-- CreateIndex
CREATE INDEX "oauthClientAssertion_expiresAt_idx" ON "oauthClientAssertion"("expiresAt");

-- CreateIndex
CREATE INDEX "oauthAccessToken_authorizationCodeId_idx" ON "oauthAccessToken"("authorizationCodeId");

-- CreateIndex
CREATE INDEX "oauthRefreshToken_authorizationCodeId_idx" ON "oauthRefreshToken"("authorizationCodeId");

-- AddForeignKey
ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "oauthResource"("identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Account identity (Better Auth 1.7)
-- ---------------------------------------------------------------------------

-- Nullable on purpose, although better-auth declares `issuer` required: a NOT NULL column would fail
-- every INSERT from a 1.6 pod still serving during a rolling deploy.
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

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

CREATE UNIQUE INDEX "Account_issuer_providerAccountId_key" ON "Account"("issuer", "providerAccountId");

COMMENT ON COLUMN "Account"."issuer" IS 'Better Auth 1.7 account identity namespace; half of the (issuer, accountId) key. Backfilled by ENG-2343.';
COMMENT ON COLUMN "oauthAccessToken"."resources" IS 'RFC 8707 resource indicators this token was approved for (GHSA-p2fr-6hmx-4528).';
COMMENT ON COLUMN "oauthRefreshToken"."resources" IS 'Full original resource grant; a refresh may narrow this set but never widen it.';
COMMENT ON COLUMN "oauthConsent"."resources" IS 'Resources the user consented to; /authorize compares requested resources against these.';
COMMENT ON TABLE "oauthResource" IS 'Protected resources the AS issues tokens for. Seeded from the oauthProvider `resources` option.';
COMMENT ON TABLE "oauthClientResource" IS 'Client-to-resource grants. With enforcePerClientResources a missing row means invalid_target.';
