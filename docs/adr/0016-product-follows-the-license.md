# The product follows the license

An organization's product, Formbricks Surveys or the Experience Suite, is derived on every request from what it is entitled to and is never stored. Self-hosted, an active or in-grace license with any Experience Suite feature makes it the Experience Suite. On Cloud, any Experience Suite entitlement in its Stripe subscription does the same, and the instance's own license is ignored. Everything else is Formbricks Surveys. In Formbricks Surveys, Experience Suite features do not exist: pages, APIs and MCP tools answer 404, and creatives, workflows, quotas and data retention stop running. The data stays in the database for when a license returns.

## Considered Options

- **A stored product setting** (an environment variable, or the setup step's choice saved to the database). Rejected because it can disagree with the license. A Surveys instance that later receives an Experience Suite key would need a second switch, and a stored "Suite" with no license would show features nobody pays for.
- **Read-only wind-down of existing Experience Suite data in Formbricks Surveys**, like Creatives Wind-down. Rejected so that Formbricks Surveys stays a clean product with no trace of the Experience Suite. Wind-down still applies inside the Experience Suite when a license drops a single feature.
- **A dedicated Experience Suite flag on the license.** Deferred, because it needs license-server work. Today the flag is derived from the feature list, so an older Enterprise license with roles, quotas, audit logs or SAML counts as the Experience Suite.
