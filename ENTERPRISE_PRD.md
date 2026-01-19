I've spent ~2 days iterating over this, setting up Stripe, building our update pricing table, etc. So even though the formatting suggests this to be AI Slob, it's hand-crafted and I've read every line to make sure there is no misleading information 😇

------

### Unified Billing & Feature Access

**Document Version:** 2.1  
**Last Updated:** January 17, 2026  
**Status:** Ready for development  

---

## 1. Executive Summary

Formbricks Cloud needs a unified, Stripe-native approach to billing, feature entitlements, and usage metering. The current implementation has billing logic scattered throughout the codebase, making it difficult to maintain pricing consistency and add new features.

This PRD outlines the requirements for:
1. Using Stripe as the single source of truth for features and billing
2. Implementing usage-based billing with graduated pricing
3. Giving customers control through spending caps

**Scope**: This initiative focuses on Formbricks Cloud. On-Premise licensing will be addressed separately.

---

## 2. Problem Statement

### Current Pain Points

1. **Scattered Billing Logic**: Feature availability is determined by code checks against `organization.billing.plan`, requiring code changes for any pricing adjustment.

2. **Inconsistent Feature Gating**: Different features use different patterns to check access, making it unclear what's available on each plan.

3. **No Usage-Based Billing**: Current plans have hard limits. Customers hitting limits must upgrade to a higher tier even if they only need slightly more capacity.

4. **No Spending Controls**: Customers on usage-based plans have no way to cap their spending.

5. **Manual Usage Tracking**: Response and user counts are tracked locally without integration to billing.

---

## 3. Goals

1. **Stripe as Source of Truth**: All feature entitlements and pricing come from Stripe, not hardcoded in the application.

2. **Usage-Based Billing**: Implement graduated pricing where customers pay for what they use beyond included amounts.

3. **Customer Control**: Allow customers to set spending caps to avoid unexpected charges.

4. **Proactive Communication**: Notify customers as they approach usage limits.

---

## 4. Feature Requirements

### 4.1 Stripe as Single Source of Truth

**Requirement**: The Formbricks instance should not contain billing or pricing logic. All feature availability must be determined by querying Stripe.

**What This Means**:
- No hardcoded plan names or feature mappings in the codebase
- No `if (plan === 'pro')` style checks
- Feature checks query Stripe Entitlements API
- Pricing displayed in UI is fetched from Stripe Products/Prices
- Plan changes take effect immediately via Stripe webhooks

**Benefits**:
- Change pricing without code deployment
- Add new plans without code changes
- A/B test pricing externally
- Single source of truth for sales, support, and product

---

### 4.2 Stripe Entitlements for Feature Access

**Requirement**: Use Stripe's Entitlements API to determine which features each customer can access.

**How It Works**:
1. Define Features in Stripe (see inventory below)
2. Attach Features to Products via ProductFeature
3. When customer subscribes, Stripe creates Active Entitlements
4. Application checks entitlements before enabling features
5. Stripe is already setup correctly with all Products & Features ✅

**Multi-Item Subscriptions Simplify Entitlements**:
- Each plan subscription includes multiple prices (flat fee + metered usage) on the **same Product**
- Since all prices belong to one Product, calling `stripe.entitlements.activeEntitlements.list()` returns all features for that plan automatically
- No need to check multiple products or stitch together entitlements from separate subscriptions

**Feature Inventory (not up-to-date but you get the idea)**:

| Feature Name | Lookup Key | Description |
|--------------|------------|-------------|
| Hide Branding | `hide-branding` | Hide "Powered by Formbricks" |
| API Access | `api-access` | Gates API key generation & API page access |
| Integrations | `integrations` | Gates integrations page & configuration |
| Custom Webhooks | `webhooks` | Webhook integrations |
| Email Follow-ups | `follow-ups` | Automated email follow-ups |
| Custom Links in Surveys | `custom-links-in-surveys` | Custom links within surveys |
| Custom Redirect URL | `custom-redirect-url` | Custom thank-you redirects |
| Two Factor Auth | `two-fa` | 2FA for user accounts |
| Contacts & Segments | `contacts` | Contact management & segmentation |
| Teams & Access Roles | `rbac` | Team-based permissions |
| Quota Management | `quota-management` | Response quota controls |
| Spam Protection | `spam-protection` | reCAPTCHA integration |
| Workspace Limit 1 | `workspace-limit-1` | Up to 1 workspaces |
| Workspace Limit 3 | `workspace-limit-3` | Up to 3 workspaces |
| Workspace Limit 5 | `workspace-limit-5` | Up to 5 workspaces |

<img width="915" height="827" alt="Image" src="https://github.com/user-attachments/assets/1f0e17b5-82c3-475c-9c05-968fdc51e948" />

---

### 4.3 Plan Structure

**Plans & Pricing**:

| Plan | Monthly Price | Annual Price | Savings |
|------|---------------|--------------|---------|
| **Hobby** | Free | Free | — |
| **Pro** | $89/month | $890/year | 2 months free |
| **Scale** | $390/month | $3,900/year | 2 months free |

**Usage Limits**:

| Plan | Workspaces | Responses/mo | Contacts/mo | Overage Billing |
|------|------------|--------------|-------------|-----------------|
| **Hobby** | 1 | 250 | — | No |
| **Pro** | 3 | 2,000 | 5,000 | Yes |
| **Scale** | 5 | 5,000 | 10,000 | Yes |

**Note**: Hobby plan does not include Respondent Identification or Contact Management. Overage billing is only available on Pro and Scale plans.

<img width="1205" height="955" alt="Image" src="https://github.com/user-attachments/assets/047d4097-f7ee-4022-920a-e2cbeb8ceb5d" />

---

### 4.4 Restricted Features (Hobby & Trial Exclusions)

**Requirement**: Certain high-risk features must be excluded from Free (Hobby) plan AND Trial users to prevent fraud and abuse. Other features are included in Trial to maximize conversion.

**Restricted Features (blocked from Hobby + Trial)**:

| Feature | Lookup Key | Abuse Risk | Why Restricted |
|---------|------------|------------|----------------|
| Custom Redirect URL | `custom-redirect-url` | High | Phishing redirects after survey |
| Custom Links in Surveys | `custom-links-in-surveys` | High | Malicious link distribution in survey content |

**Trial-Included Features (to drive conversion)**:

| Feature | Lookup Key | Why Included in Trial |
|---------|------------|----------------------|
| Webhooks | `webhooks` | Low abuse risk, high setup effort = conversion driver |
| API Access | `api-access` | Low abuse risk, high integration value |
| Integrations | `integrations` | Low abuse risk, high integration value |
| Email Follow-ups | `follow-ups` | Requires email verification, monitored |
| Hide Branding | `hide-branding` | No abuse risk, strong conversion driver |
| RBAC | `rbac` | No abuse risk, team adoption driver |
| Spam Protection | `spam-protection` | Actually prevents abuse |
| Quota Management | `quota-management` | Administrative feature |

**Implementation**:
- Restricted features are NOT attached to Hobby or Trial products in Stripe
- Trial includes most Pro/Scale features to maximize value demonstration
- Application checks entitlements via Stripe API - if feature not present, show existing upgrade UI

---

### 4.5 Usage-Based Billing with Graduated Pricing

<img width="1041" height="125" alt="Image" src="https://github.com/user-attachments/assets/f12a56da-89d2-4784-b3c0-6c55dbee85e6" />

**Requirement**: Implement usage-based billing where customers pay a base fee that includes a usage allowance, with flat overage pricing.

**Metrics to Meter**:

| Metric | Event Name | Description |
|--------|------------|-------------|
| **Responses** | `response_created` | Survey responses submitted |
| **Identified Contacts** | `unique_contact_identified` | Unique contacts identified per month |

**Identified Contacts Definition (ON HOLD)**:
An identified contact is one that has been identified in the current billing period via:
- SDK call: `formbricks.setUserId(userId)`
- Personal Survey Link access
- This OUT OF SCOPE for the first iteration to not become a blocker. We can add it if all works end-to-end

**Counting Rules**:
- Each contact identification counts (even if same contact identified multiple times via different methods)
- Same contact re-accessing their personal link = 1 count (same contact)
- Billing period is monthly (even for annual subscribers)
- Meter events sent immediately (real-time)

**Hard Limits via Stripe Metering**:
- Usage is metered through Stripe for billing AND enforcement
- When included usage is exhausted, overage rates apply
- No separate local limit enforcement needed

---

### 4.6 Spending Caps

**Requirement**: Customers must be able to set a maximum monthly spend for usage-based charges.

**Behavior**:

| Cap Setting | Effect |
|-------------|--------|
| No cap (default) | Usage billed without limit |
| Cap with "Warn" | Notifications sent, billing continues |
| Cap with "Pause" | Surveys paused when cap reached |

**Configuration**:
- Minimum spending cap: **$10**
- No grace period when cap is hit
- Immediate pause if "Pause" mode selected
- Stripe does not provide spending caps out of the box, this is something we need to custom develop

**When Cap is Reached (Pause mode)**:
- All surveys for the organization stop collecting responses (needs to be implemented)
- Existing responses are preserved
- In-app banner explains the pause
- Email notification sent to billing contacts
- Owner can lift pause or increase cap

<img width="925" height="501" alt="Image" src="https://github.com/user-attachments/assets/511d1ec6-4550-4aec-8f31-ab68e8c9e383" />

_The Pause vs. Alert mode is missing so far._

---

### 4.7 Usage Alerts via Stripe Meter Alerts

**Requirement**: Proactively notify customers as they approach their included usage limits.

**Alert Thresholds**:

| Threshold | Notification |
|-----------|--------------|
| 80% of included | Email notification |
| 90% of included | Email + in-app banner |
| 100% of included | Email + in-app + (if cap) action |

**Notification Content**:
- Current usage vs included amount
- What happens next (overage pricing applies)
- Link to upgrade or adjust spending cap

<img width="415" height="348" alt="Image" src="https://github.com/user-attachments/assets/7bd990b4-7150-4357-af84-9c5e98f75140" />

---

### 4.8 Annual Billing with Monthly Limits

**Requirement**: Support annual payment option while keeping all usage limits monthly.

**Behavior**:
- Annual subscribers pay upfront for 12 months
- **2 months free** discount (annual = 10x monthly price)
- Usage limits reset monthly (same as monthly subscribers)
- Overage is billed monthly
- Example: Annual Pro pays $890/year, gets 2,000 responses/month every month

<img width="1033" height="429" alt="Image" src="https://github.com/user-attachments/assets/58df55c7-e20f-448c-953d-e62c57268421" />

---

### 4.9 Reverse Trial Experience

**Requirement**: New users should experience premium features immediately through a Reverse Trial model.

**Trigger**: We have UI to present to them to opt into the free trial

**Trial Terms**:
- Duration: 14 days
- Features: Enroll to Trial Product (free)
- Limits: We have to see how to enforce those, gotta check what Stripe API offers us. Probably a dedicated Trial Meter
- No payment required to start
- Stripe customer created immediately (for metering)

**Post-Trial (No Conversion)**:
- Downgrade to Hobby (Free) tier immediately
- Pro features disabled immediately
- Data preserved but locked behind upgrade

---

### 4.10 Stripe Customer Creation on Signup

**Requirement**: Create a Stripe customer immediately when a new organization is created.

**Rationale**: 
- Enables usage metering from day one
- Stripe handles hard limits via metering
- Simplifies upgrade flow (customer already exists)

**What Gets Created**:
- Stripe Customer with organization ID in metadata
- No subscription (Hobby tier has no subscription)
- No payment method (added on first upgrade)

---

### 5.1 Subscription Architecture: Multi-Item Subscriptions

**Key Insight**: Each plan uses a **Subscription with Multiple Items** — one flat-fee price and metered usage prices, all belonging to the same Product. This allows us to charge for the base plan, meter and charge per used item.

**How It Works**:

```javascript
// Creating a Pro subscription with flat fee + usage metering
const subscription = await stripe.subscriptions.create({
  customer: 'cus_12345',
  items: [
    { price: 'price_pro_monthly' },           // $89/mo flat fee
    { price: 'price_pro_responses_usage' }, // Metered responses
    { price: 'price_pro_contacts_usage' },  // Metered contacts 
  ],
});
```

**Why This Matters for Entitlements**:
- All prices belong to the **same Product** (e.g., `prod_ProPlan`)
- Stripe Entitlements API automatically returns all features attached to that Product
- No need to check multiple products or subscriptions
- Single source of truth for feature access

**What Customers See** (Single Invoice):

| Description | Qty | Amount |
|-------------|-----|--------|
| Pro Plan (Jan 1 - Feb 1) | 1 | $89.00 |
| Pro Plan - Responses (Jan 1 - Feb 1) | 1,500 (First 1,000 included) | $40.00 |
| Pro Plan - Contacts (Jan 1 - Feb 1) | 2,500 (All included) | $0.00 |
| **Total** | | **$129.00** |

### 5.2 Products & Prices

Each plan Product contains multiple Prices:

| Product | Stripe ID | Prices |
|---------|-----------|--------|
| **Hobby Tier** | `prod_ToYKB5ESOMZZk5` | Free (no subscription required) |
| **Pro Tier** | `prod_ToYKQ8WxS3ecgf` | `price_pro_monthly` ($89), `price_pro_yearly` ($890), `price_pro_usage_responses`, `price_pro_usage_contacts` |
| **Scale Tier** | `prod_ToYLW5uCQTMa6v` | `price_scale_monthly` ($390), `price_scale_yearly` ($3,900), `price_scale_usage_responses`, `price_scale_usage_contacts` |
| **Trial Tier** | `prod_TodVcJiEnK5ABK` | `price_trial_free` ($0), metered prices for tracking |

**Note**: Response and Contact metered prices use **graduated tiers** where the first N units are included (priced at $0), then overage rates apply.


---

## 6. Non-Functional Requirements

### 6.1 Performance

- Entitlement checks: <100ms (p50), <200ms (p99) with caching
- Usage metering: Non-blocking, immediate send
- Spending cap checks: <50ms

### 6.2 Reliability

- Stripe unavailable: Use cached entitlements (max 5 min stale)
- Meter event fails: Queue for retry (at-least-once delivery)
- Webhook missed: Entitlements auto-refresh on access

### 6.3 Data Consistency

- Stripe is source of truth
- Local `organization.billing` is a cache only
- Cache invalidated via webhooks

---

## 7. Migration Considerations

### Existing Customers with Custom Limits

**Problem**: Some existing customers have negotiated custom limits that don't fit the new plan structure.

**Approach**: Grandfather indefinitely on legacy pricing until they choose to migrate.

- Existing customers keep their current plans and limits
- No forced migration
- New billing system only applies to new signups and customers who voluntarily upgrade/change plans
- Legacy customers get a simplified view with the new usage meters UI and a the "Manage subscription" button. We hide all of the other UI and prompt them to reach out to Support to change their pricing (Alert component)

---

## 8. Key Decisions

| Topic | Decision |
|-------|----------|
| Free tier metering | Use Stripe for hard limits (no local enforcement) |
| Annual discount | 2 months free |
| Minimum spending cap | $10 |
| Cap grace period | None (immediate) |
| Contact identification counting | Each identification counts |
| Personal link re-access | Same contact = 1 count |
| Downgrade behavior for restricted features | Immediate disable |
| Meter event timing | Immediate (real-time) |
| Currency | USD only |
| Default spending cap | No cap |
| Overage visibility | Billing page |
| Migration for custom limits | Grandfather indefinitely |

---

## 9. Out of Scope

1. **On-Premise licensing**: Will be addressed separately
2. **Self-serve downgrade**: Handled via Stripe Customer Portal
3. **Refunds**: Handled via Stripe Dashboard
4. **Tax calculation**: Handled by Stripe Tax
5. **Invoice customization**: Handled via Stripe settings

---

## 10. Setting up

**Stripe** Sandbox Cloud: Dev

<img width="300" height="180" alt="Image" src="https://github.com/user-attachments/assets/3e6a7fb6-8efb-4cb5-acf0-ccc2a5efabd2" />

In this branch you find;
- All of the dummy UI screenshotted here. Make sure to clean up after it was successfully implemented (has dummy UI code)
- A comprehensive analysis of our current, inconsistent feature flagging called ENTERPRISE_FEATURE_ANALYSIS