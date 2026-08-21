# Security Policy of Formbricks

This is Formbrick's security policy. Please report vulnerabilities
privately via <security@formbricks.com> rather than in public.

## Introduction

Formbricks is dedicated to maintaining the integrity and security of our systems and our clients' data. In our pursuit to keep our technology environment safe, we welcome the collaborative efforts of our user community and security researchers to enhance security protocols and continuously secure our platform. This security policy outlines our approach towards handling data, ensuring secure practices, and managing the disclosure of vulnerabilities.

## I. Third-Party Data Usage Policy

We affirm our commitment towards meticulous validation of data usage and collection scope by any third-party library or integration utilized in our operations. We adhere to the following protocols:

- Rigorous vetting of third-party services to confirm adherence to our data usage and privacy standards.
- Continuous monitoring and assessment of third-party practices to ensure ongoing compliance.
- Immediate action to mitigate risks if a third-party deviates from agreed-upon data practices.

## II. Annual Penetration Testing (Pentest)

To understand and bolster our security stature, Formbricks undertakes:

- Annual penetration testing executed by an independent, skilled third party.
- Prioritization of any identified issues, with immediate action on critical vulnerabilities.
- Transparent communication and learnings shared with relevant stakeholders.

## III. Vulnerability Reporting and Management

Please do not use attacks on physical security, social engineering, distributed denial of service, spam or applications of third parties.

> **Formbricks does not offer bug bounties.** We do not pay for vulnerability reports of any kind. Public credit for your finding is available on request — see [D. Bug Bounties and Credit](#d-bug-bounties-and-credit).

### **A. When to Report a Vulnerability**

We invite you to report if:

- A potential security vulnerability in Formbricks is identified.
- There is uncertainty about how a vulnerability affects our platform.
- A vulnerability is detected in a dependent project of Formbricks.
- An action was executed which, in your belief, should be restricted.

### **B. When Reporting is Unnecessary**

Avoid reporting if:

- Assistance is needed to optimize Formbricks for security – please engage on Github Discussions for this.
- Help is required for applying security-related updates.
- The concern is not related to security.

### **C. Vulnerability Reporting Procedure**

In the interest of responsibly managing vulnerabilities, please adhere to the following procedure:

> Do not reveal the problem to others until it has been resolved.

1. **Send a Detailed Report**:
   - Send an email to [security@formbricks.com](mailto:security@formbricks.com).
   - Please do not open a GitHub issue for a vulnerability. The issue tracker is public, so filing there discloses the problem before a fix exists — which is what the line above asks you to avoid.
   - Include:
     - Problem description.
     - Detailed, reproducible steps, with screenshots where possible.
     - Affected version(s).
     - Known possible mitigations.
     - Your preferred contact method.
2. **Acknowledgement of Receipt**:
   - Our security team will acknowledge receipt and provide an initial response within 48 hours.
   - Following verification of the vulnerability and the fix, a release plan will be formulated, with the fix deployed between 7 to 28 days, depending on the severity and complexity.
3. **Ongoing Communication**:
   - A project maintainer may engage with you for additional details or clarification.
   - We appreciate your patience as we explore the reported item, verify its authenticity, and ascertain the existence of a vulnerability.

### **D. Bug Bounties and Credit**

Formbricks does not run a bug bounty program, and we want to be upfront about that before you invest your time:

- We do not pay bounties, rewards, gift cards, or goodwill payments for security reports. There are no exceptions, and this is not decided case by case.
- We have offered both a bounty and one-off payments in the past. The result was a sharp increase in low-quality and automated reports rather than better ones, so we stopped. It is a settled policy rather than a question of budget.
- Please do not attach an invoice, a payment request, or a payment condition to a report. We will still read and act on the report, but the answer on payment will be no.

What we do offer is **credit**. If you would like to be named, tell us in your report or at any point before the fix ships, and we will mention you in the release notes for the fix.

None of this changes how seriously we treat your report. A well-written vulnerability report is real work, and we are genuinely grateful for it — we simply pay it back in credit and a fast fix rather than in money.

---

### Please Read the below carefully

If you have followed the instructions above, we will **not** take any legal action against you in regard to the report.
We will handle your report with strict confidentiality and will not pass on your personal details to third parties without your permission. We will keep you informed of the progress towards resolving the problem. In the public information concerning the problem reported, we will name you as the discoverer of the problem only if you have asked to be credited. Otherwise, we will not publish your identity.

We, at Formbricks, wish to express our gratitude towards all individuals who assist us in fortifying our security posture. Your responsible disclosure and cooperation enable us to elevate our security protocols, safeguarding our platform and data therein.
