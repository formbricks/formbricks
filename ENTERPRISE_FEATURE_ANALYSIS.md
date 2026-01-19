# Enterprise Feature Access: Status Quo Analysis

## Executive Summary

Formbricks currently uses **two completely different mechanisms** to gate enterprise features depending on deployment type:

| Deployment | Gating Mechanism | Activation | Feature Control |
|------------|------------------|------------|-----------------|
| **Cloud** (`IS_FORMBRICKS_CLOUD=1`) | Billing Plan (`organization.billing.plan`) | Stripe subscription | Plan-based (FREE/STARTUP/CUSTOM) |
| **On-Premise** | License Key (`ENTERPRISE_LICENSE_KEY`) | License API validation | License feature flags |

This dual approach creates **significant complexity**, **code duplication**, and **inconsistent behavior** across the codebase.

---

## 1. Core Architecture

### 1.1 Cloud (Formbricks Cloud)

**Source of Truth:** `organization.billing.plan`

```typescript
// packages/database/zod/organizations.ts
plan: z.enum(["free", "startup", "scale", "enterprise"]).default("free")
```

**Plans and Limits:**
- `FREE`: 3 projects, 1,500 responses/month, 2,000 MIU
- `STARTUP`: 3 projects, 5,000 responses/month, 7,500 MIU
- `CUSTOM`: Unlimited (negotiated limits)

**Activation:** Stripe webhook updates `organization.billing` on checkout/subscription events.

### 1.2 On-Premise (Self-Hosted)

**Source of Truth:** `ENTERPRISE_LICENSE_KEY` environment variable

**License Features Schema:**
```typescript
// apps/web/modules/ee/license-check/types/enterprise-license.ts
{
  isMultiOrgEnabled: boolean,
  contacts: boolean,
  projects: number | null,
  whitelabel: boolean,
  removeBranding: boolean,
  twoFactorAuth: boolean,
  sso: boolean,
  saml: boolean,
  spamProtection: boolean,
  ai: boolean,
  auditLogs: boolean,
  multiLanguageSurveys: boolean,
  accessControl: boolean,
  quotas: boolean,
}
```

**Activation:** License key validated against `https://ee.formbricks.com/api/licenses/check` (cached for 24h, grace period of 3 days).

---

## 2. Feature Gating Patterns

### 2.1 Pattern A: Dual-Path Check (Most Common)

Features that need **both** Cloud billing **and** on-premise license checks:

```typescript
// apps/web/modules/ee/license-check/lib/utils.ts
const getFeaturePermission = async (billingPlan, featureKey) => {
  const license = await getEnterpriseLicense();

  if (IS_FORMBRICKS_CLOUD) {
    return license.active && billingPlan !== PROJECT_FEATURE_KEYS.FREE;
  } else {
    return license.active && !!license.features?.[featureKey];
  }
};
```

**Used by:**
- `getRemoveBrandingPermission()` - Remove branding
- `getWhiteLabelPermission()` - Whitelabel features
- `getBiggerUploadFileSizePermission()` - Large file uploads
- `getIsSpamProtectionEnabled()` - reCAPTCHA spam protection
- `getMultiLanguagePermission()` - Multi-language surveys
- `getAccessControlPermission()` - Teams & roles
- `getIsQuotasEnabled()` - Quota management
- `getOrganizationProjectsLimit()` - Project limits

### 2.2 Pattern B: License-Only Check

Features checked **only** against license (works same for cloud and on-premise):

```typescript
// apps/web/modules/ee/license-check/lib/utils.ts
const getSpecificFeatureFlag = async (featureKey) => {
  const licenseFeatures = await getLicenseFeatures();
  if (!licenseFeatures) return false;
  return licenseFeatures[featureKey] ?? false;
};
```

**Used by:**
- `getIsMultiOrgEnabled()` - Multiple organizations
- `getIsContactsEnabled()` - Contacts & segments
- `getIsTwoFactorAuthEnabled()` - 2FA
- `getIsSsoEnabled()` - SSO
- `getIsAuditLogsEnabled()` - Audit logs

### 2.3 Pattern C: Cloud-Only (No License Check)

Features available only on Cloud, gated purely by billing plan:

```typescript
// apps/web/modules/survey/lib/permission.ts
export const getExternalUrlsPermission = async (billingPlan) => {
  if (IS_FORMBRICKS_CLOUD) return billingPlan !== PROJECT_FEATURE_KEYS.FREE;
  return true; // Always allowed on self-hosted
};
```

**Used by:**
- External URLs permission
- Survey follow-ups (Custom plan only)

### 2.4 Pattern D: On-Premise Only (Disabled on Cloud)

Features explicitly disabled on Cloud:

```typescript
// apps/web/modules/ee/license-check/lib/utils.ts
export const getIsSamlSsoEnabled = async () => {
  if (IS_FORMBRICKS_CLOUD) return false; // Never on Cloud
  const licenseFeatures = await getLicenseFeatures();
  return licenseFeatures.sso && licenseFeatures.saml;
};
```

**Used by:**
- SAML SSO
- Pretty URLs (slug feature)
- Domain/Organization settings page

---

## 3. Files Using Enterprise Features

### 3.1 Core License/Feature Check Files

| File | Purpose |
|------|---------|
| `apps/web/modules/ee/license-check/lib/license.ts` | License fetching & caching |
| `apps/web/modules/ee/license-check/lib/utils.ts` | Permission check functions |
| `apps/web/modules/ee/license-check/types/enterprise-license.ts` | Type definitions |
| `apps/web/lib/constants.ts` | `IS_FORMBRICKS_CLOUD`, `ENTERPRISE_LICENSE_KEY` |

### 3.2 Feature-Specific Implementation Files

#### Remove Branding
- `apps/web/modules/ee/whitelabel/remove-branding/actions.ts`
- `apps/web/modules/ee/whitelabel/remove-branding/components/branding-settings-card.tsx`
- `apps/web/modules/projects/settings/look/page.tsx`
- `apps/web/modules/projects/settings/actions.ts`

#### Whitelabel / Email Customization
- `apps/web/modules/ee/whitelabel/email-customization/actions.ts`
- `apps/web/app/(app)/environments/[environmentId]/settings/(organization)/general/page.tsx`
- `apps/web/app/(app)/environments/[environmentId]/settings/(organization)/domain/page.tsx`

#### Multi-Language Surveys
- `apps/web/modules/ee/multi-language-surveys/lib/actions.ts`
- `apps/web/modules/ee/multi-language-surveys/components/*.tsx`
- `apps/web/modules/ee/languages/page.tsx`

#### Contacts & Segments
- `apps/web/modules/ee/contacts/segments/actions.ts`
- `apps/web/modules/ee/contacts/page.tsx`
- `apps/web/modules/ee/contacts/api/v1/**/*.ts`
- `apps/web/modules/ee/contacts/api/v2/**/*.ts`

#### Teams & Access Control
- `apps/web/modules/ee/teams/team-list/components/teams-view.tsx`
- `apps/web/modules/ee/role-management/actions.ts`
- `apps/web/modules/organization/settings/teams/page.tsx`
- `apps/web/modules/organization/settings/teams/actions.ts`

#### SSO / SAML
- `apps/web/modules/ee/sso/lib/sso-handlers.ts`
- `apps/web/modules/ee/auth/saml/api/**/*.ts`
- `apps/web/modules/ee/auth/saml/lib/*.ts`
- `apps/web/modules/auth/lib/authOptions.ts`

#### Two-Factor Authentication
- `apps/web/modules/ee/two-factor-auth/actions.ts`
- `apps/web/modules/ee/two-factor-auth/components/*.tsx`

#### Quotas
- `apps/web/modules/ee/quotas/actions.ts`
- `apps/web/modules/ee/quotas/components/*.tsx`
- `apps/web/modules/ee/quotas/lib/*.ts`

#### Audit Logs
- `apps/web/modules/ee/audit-logs/lib/handler.ts`
- `apps/web/modules/ee/audit-logs/lib/service.ts`

#### Billing (Cloud Only)
- `apps/web/modules/ee/billing/page.tsx`
- `apps/web/modules/ee/billing/api/lib/*.ts`
- `apps/web/modules/ee/billing/components/*.tsx`

### 3.3 API Routes Using Feature Checks

| Route | Feature Check |
|-------|---------------|
| `apps/web/app/api/v1/client/[environmentId]/responses/route.ts` | Spam protection |
| `apps/web/app/api/v2/client/[environmentId]/responses/route.ts` | Spam protection |
| `apps/web/app/api/v1/client/[environmentId]/environment/lib/environmentState.ts` | Cloud limits |
| `apps/web/modules/ee/contacts/api/v1/client/[environmentId]/user/route.ts` | Contacts |
| `apps/web/modules/api/v2/management/responses/lib/response.ts` | Cloud limits |

### 3.4 UI Pages with Conditional Rendering

| Page | Condition |
|------|-----------|
| `apps/web/app/(app)/environments/[environmentId]/settings/(organization)/billing/` | Cloud only |
| `apps/web/app/(app)/environments/[environmentId]/settings/(organization)/enterprise/page.tsx` | On-premise only |
| `apps/web/app/(app)/environments/[environmentId]/settings/(organization)/domain/page.tsx` | On-premise only |
| `apps/web/app/p/[slug]/page.tsx` (Pretty URLs) | On-premise only |

---

## 4. Configuration & Environment Variables

### 4.1 Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `IS_FORMBRICKS_CLOUD` | Enables cloud mode | `"0"` |
| `ENTERPRISE_LICENSE_KEY` | License key for on-premise | (empty) |
| `STRIPE_SECRET_KEY` | Stripe API key (Cloud) | (empty) |
| `AUDIT_LOG_ENABLED` | Enable audit logs | `"0"` |
| `SAML_DATABASE_URL` | SAML configuration DB | (empty) |

### 4.2 Database Schema

```prisma
// Organization billing stored in JSON column
billing: {
  stripeCustomerId: string | null,
  plan: "free" | "startup" | "scale" | "enterprise",
  period: "monthly" | "yearly",
  limits: {
    projects: number | null,
    monthly: {
      responses: number | null,
      miu: number | null,
    }
  },
  periodStart: Date | null
}
```

---

## 5. Problems with Current Approach

### 5.1 Code Duplication

Almost every feature check function has this pattern:
```typescript
if (IS_FORMBRICKS_CLOUD) {
  // Check billing plan
} else {
  // Check license feature
}
```

This is repeated in:
- 8+ permission check functions in `utils.ts`
- 30+ files that consume these functions
- Multiple API routes and pages

### 5.2 Inconsistent Feature Gating

| Feature | Cloud Gating | On-Premise Gating |
|---------|--------------|-------------------|
| Remove Branding | `plan !== FREE` | `license.features.removeBranding` |
| Multi-Language | `plan === CUSTOM` OR `license.multiLanguageSurveys` | `license.multiLanguageSurveys` |
| Follow-ups | `plan === CUSTOM` | Always allowed |
| SAML SSO | Never allowed | `license.sso && license.saml` |
| Teams | `plan === CUSTOM` OR `license.accessControl` | `license.accessControl` |

### 5.3 Confusing License Requirement on Cloud

Cloud deployments still require `ENTERPRISE_LICENSE_KEY` to be set for enterprise features to work:
```typescript
// utils.ts - getFeaturePermission
if (IS_FORMBRICKS_CLOUD) {
  return license.active && billingPlan !== PROJECT_FEATURE_KEYS.FREE;
  //     ^^^^^^^^^^^^^^ Still checks license!
}
```

This means Cloud needs **both**:
1. Active billing plan (Stripe subscription)
2. Active enterprise license

### 5.4 Fallback Logic Complexity

```typescript
const featureFlagFallback = async (billingPlan) => {
  const license = await getEnterpriseLicense();
  if (IS_FORMBRICKS_CLOUD) return license.active && billingPlan === PROJECT_FEATURE_KEYS.CUSTOM;
  else if (!IS_FORMBRICKS_CLOUD) return license.active;
  return false;
};
```

Features have "fallback" behavior for backwards compatibility, adding another layer of complexity.

### 5.5 Testing Complexity

Tests must mock both:
- `IS_FORMBRICKS_CLOUD` constant
- `getEnterpriseLicense()` function
- `organization.billing.plan` in some cases

See: `apps/web/modules/ee/license-check/lib/utils.test.ts` (400+ lines of test mocking)

---

## 6. Feature Availability Matrix

| Feature | Free (Cloud) | Startup (Cloud) | Custom (Cloud) | No License (On-Prem) | License (On-Prem) |
|---------|--------------|-----------------|----------------|---------------------|-------------------|
| Remove Branding | ❌ | ✅ | ✅ | ❌ | ✅* |
| Whitelabel | ❌ | ✅ | ✅ | ❌ | ✅* |
| Multi-Language | ❌ | ❌ | ✅ | ❌ | ✅* |
| Teams & Roles | ❌ | ❌ | ✅ | ❌ | ✅* |
| Contacts | ❌ | ❌ | ❌ | ❌ | ✅* |
| SSO (OIDC) | ❌ | ❌ | ❌ | ❌ | ✅* |
| SAML SSO | ❌ | ❌ | ❌ | ❌ | ✅* |
| 2FA | ❌ | ❌ | ❌ | ❌ | ✅* |
| Audit Logs | ❌ | ❌ | ❌ | ❌ | ✅* |
| Quotas | ❌ | ❌ | ✅ | ❌ | ✅* |
| Spam Protection | ❌ | ❌ | ✅ | ❌ | ✅* |
| Follow-ups | ❌ | ❌ | ✅ | ✅ | ✅ |
| Pretty URLs | ❌ | ❌ | ❌ | ✅ | ✅ |
| Projects Limit | 3 | 3 | Custom | 3 | Custom* |

*Depends on specific license feature flags

---

## 7. Recommendations for Refactoring

### 7.1 Unified Feature Access Layer

Create a single `FeatureAccess` service that abstracts the deployment type:

```typescript
interface FeatureAccessService {
  canAccessFeature(feature: FeatureKey, context: AccessContext): Promise<boolean>;
  getLimit(limit: LimitKey, context: LimitContext): Promise<number>;
}
```

### 7.2 Normalize Feature Flags

Both Cloud and On-Premise should use the same feature flag schema. Cloud billing plans should map to predefined feature sets.

### 7.3 Remove License Requirement from Cloud

Cloud should not need `ENTERPRISE_LICENSE_KEY`. The license server should be bypassed entirely, with features controlled by billing plan.

### 7.4 Consider Feature Entitlements

Move to an "entitlements" model where:
- Cloud: Stripe subscription metadata defines entitlements
- On-Premise: License API returns entitlements

Both resolve to the same `TFeatureEntitlements` type.

---

## 8. Files That Would Need Changes

### High Priority (Core Logic)
1. `apps/web/modules/ee/license-check/lib/license.ts`
2. `apps/web/modules/ee/license-check/lib/utils.ts`
3. `apps/web/lib/constants.ts`

### Medium Priority (Feature Implementations)
4. All files in `apps/web/modules/ee/*/actions.ts`
5. `apps/web/modules/environments/lib/utils.ts`
6. `apps/web/modules/survey/lib/permission.ts`
7. `apps/web/modules/survey/follow-ups/lib/utils.ts`

### Lower Priority (UI Conditional Rendering)
8. Settings pages with `IS_FORMBRICKS_CLOUD` checks
9. `UpgradePrompt` component usages
10. Navigation components

---

## 9. Summary

The current implementation has **organic complexity** from evolving independently for Cloud and On-Premise deployments. A refactor should:

1. **Unify** the feature access mechanism behind a single interface
2. **Simplify** by removing the dual-check pattern
3. **Normalize** feature definitions across deployment types
4. **Test** with a cleaner mocking strategy

This would reduce the 100+ files touching enterprise features to a single source of truth, making the codebase more maintainable and reducing bugs from inconsistent feature gating.
