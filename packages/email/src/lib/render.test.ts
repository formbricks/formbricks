import { createElement } from "react";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  Body,
  Head,
  Html,
  Section,
  Tailwind,
  Text,
  render,
  renderAccountDeletionEmail,
  renderEmailCustomizationPreviewEmail,
  renderEmbedSurveyPreviewEmail,
  renderFollowUpEmail,
  renderForgotPasswordEmail,
  renderInviteAcceptedEmail,
  renderInviteEmail,
  renderLinkSurveyEmail,
  renderNewEmailVerification,
  renderPasswordResetNotifyEmail,
  renderResponseFinishedEmail,
  renderVerificationEmail,
} from "../index";
import { exampleData } from "./example-data";
import { t } from "./mock-translate";

// `elements` is pre-processed by the web app rather than by the template, so the
// preview fixture does not carry it. Keep a minimal stand-in here.
const responseFinishedElements = [
  {
    element: "What did you like most?",
    response: "The customer service was excellent!",
    type: TSurveyElementTypeEnum.OpenText,
  },
];

const renderers: [string, () => Promise<string>][] = [
  ["renderVerificationEmail", () => renderVerificationEmail({ ...exampleData.verificationEmail, t })],
  ["renderForgotPasswordEmail", () => renderForgotPasswordEmail({ ...exampleData.forgotPasswordEmail, t })],
  ["renderAccountDeletionEmail", () => renderAccountDeletionEmail({ ...exampleData.deleteAccountEmail, t })],
  [
    "renderNewEmailVerification",
    () => renderNewEmailVerification({ ...exampleData.newEmailVerification, t }),
  ],
  ["renderPasswordResetNotifyEmail", () => renderPasswordResetNotifyEmail({ t })],
  ["renderInviteEmail", () => renderInviteEmail({ ...exampleData.inviteEmail, t })],
  ["renderInviteAcceptedEmail", () => renderInviteAcceptedEmail({ ...exampleData.inviteAcceptedEmail, t })],
  ["renderLinkSurveyEmail", () => renderLinkSurveyEmail({ ...exampleData.linkSurveyEmail, logoUrl: "", t })],
  [
    "renderEmbedSurveyPreviewEmail",
    () => renderEmbedSurveyPreviewEmail({ ...exampleData.embedSurveyPreviewEmail, t }),
  ],
  [
    "renderResponseFinishedEmail",
    () =>
      renderResponseFinishedEmail({
        ...exampleData.responseFinishedEmail,
        elements: responseFinishedElements,
        t,
      }),
  ],
  [
    "renderEmailCustomizationPreviewEmail",
    () => renderEmailCustomizationPreviewEmail({ ...exampleData.emailCustomizationPreviewEmail, t }),
  ],
  ["renderFollowUpEmail", () => renderFollowUpEmail({ ...exampleData.followUpEmail, t })],
];

describe.each(renderers)("%s", (_name, renderEmail) => {
  test("returns a complete standalone HTML document", async () => {
    const html = await renderEmail();

    expect(html).toMatch(/^<!DOCTYPE html/i);
    expect(html).toContain("</html>");
  });

  test("resolves every translation key instead of leaking raw keys", async () => {
    const html = await renderEmail();

    expect(html).not.toMatch(/\b(?:emails|common)\.[a-z0-9_]+/);
  });

  test("inlines Tailwind utilities as styles rather than shipping class names", async () => {
    const html = await renderEmail();

    // The shared chrome sets `p-6` on the body and `max-w-xl rounded-md` on the card.
    // Mail clients ignore stylesheets, so those must arrive as inline declarations.
    expect(html).toContain("padding:1.5rem");
    expect(html).toContain("max-width:36rem");
    expect(html).toContain("border-radius:0.375rem");
    expect(html).not.toMatch(/class="[^"]*\bmax-w-xl\b/);
  });
});

describe("translation threading", () => {
  test("passes interpolation values through to the rendered copy", async () => {
    const html = await renderForgotPasswordEmail({
      verifyLink: exampleData.forgotPasswordEmail.verifyLink,
      linkValidityInMinutes: 30,
      t,
    });

    expect(html).toContain("The link is valid for 30 minutes.");
  });

  test("interpolates caller data into the notification copy", async () => {
    const html = await renderResponseFinishedEmail({
      ...exampleData.responseFinishedEmail,
      responseCount: 15,
      elements: responseFinishedElements,
      t,
    });

    expect(html).toContain(exampleData.responseFinishedEmail.survey.name);
    // The response that triggered the notification is not "more", so the CTA counts 14.
    expect(html).toContain("View 14 more responses");
  });

  test("falls back to the summary CTA when this is the only response", async () => {
    const html = await renderResponseFinishedEmail({
      ...exampleData.responseFinishedEmail,
      responseCount: 1,
      elements: responseFinishedElements,
      t,
    });

    expect(html).toContain("View survey summary");
    expect(html).not.toContain("more responses");
  });
});

describe("legal footer", () => {
  test("renders imprint and privacy links only when the legal props are supplied", async () => {
    const withLegal = await renderVerificationEmail({
      ...exampleData.verificationEmail,
      ...exampleData.legalProps,
      t,
    });
    const withoutLegal = await renderVerificationEmail({ ...exampleData.verificationEmail, t });

    expect(withLegal).toContain(exampleData.legalProps.imprintUrl);
    expect(withLegal).toContain(exampleData.legalProps.privacyUrl);
    expect(withLegal).toContain(exampleData.legalProps.imprintAddress);
    expect(withoutLegal).not.toContain(exampleData.legalProps.imprintUrl);
    expect(withoutLegal).not.toContain(exampleData.legalProps.privacyUrl);
    expect(withoutLegal).not.toContain(exampleData.legalProps.imprintAddress);
  });
});

describe("Tailwind render engine", () => {
  // `@react-email/tailwind` — not anything configured in this package — decides which
  // Tailwind version compiles the template classes. Pin that contract: these utilities
  // exist only in v4, so a downgrade would drop the declarations silently.
  test("compiles Tailwind v4 utilities", async () => {
    const html = await render(
      createElement(
        Tailwind,
        null,
        createElement(
          Html,
          null,
          createElement(Head, null),
          createElement(
            Body,
            null,
            createElement(
              Section,
              { className: "inset-shadow-sm shadow-xs" },
              createElement(Text, { className: "text-shadow-lg" }, "v4")
            )
          )
        )
      )
    );

    expect(html).toContain("text-shadow:");
    expect(html).toContain("box-shadow:inset");
  });
});
