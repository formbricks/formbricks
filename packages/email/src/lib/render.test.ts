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

// Render every email with the legal props supplied. The imprint/privacy footer is a
// conditional branch of the shared chrome, so leaving them out would hide anything that
// only goes wrong once that branch renders.
const legal = exampleData.legalProps;

const renderers: [string, () => Promise<string>][] = [
  [
    "renderVerificationEmail",
    () => renderVerificationEmail({ ...exampleData.verificationEmail, ...legal, t }),
  ],
  [
    "renderForgotPasswordEmail",
    () => renderForgotPasswordEmail({ ...exampleData.forgotPasswordEmail, ...legal, t }),
  ],
  [
    "renderAccountDeletionEmail",
    () => renderAccountDeletionEmail({ ...exampleData.deleteAccountEmail, ...legal, t }),
  ],
  [
    "renderNewEmailVerification",
    () => renderNewEmailVerification({ ...exampleData.newEmailVerification, ...legal, t }),
  ],
  ["renderPasswordResetNotifyEmail", () => renderPasswordResetNotifyEmail({ ...legal, t })],
  ["renderInviteEmail", () => renderInviteEmail({ ...exampleData.inviteEmail, ...legal, t })],
  [
    "renderInviteAcceptedEmail",
    () => renderInviteAcceptedEmail({ ...exampleData.inviteAcceptedEmail, ...legal, t }),
  ],
  [
    "renderLinkSurveyEmail",
    () => renderLinkSurveyEmail({ ...exampleData.linkSurveyEmail, logoUrl: "", ...legal, t }),
  ],
  [
    "renderEmbedSurveyPreviewEmail",
    () => renderEmbedSurveyPreviewEmail({ ...exampleData.embedSurveyPreviewEmail, ...legal, t }),
  ],
  [
    "renderResponseFinishedEmail",
    () =>
      renderResponseFinishedEmail({
        ...exampleData.responseFinishedEmail,
        elements: responseFinishedElements,
        ...legal,
        t,
      }),
  ],
  [
    "renderEmailCustomizationPreviewEmail",
    () =>
      renderEmailCustomizationPreviewEmail({ ...exampleData.emailCustomizationPreviewEmail, ...legal, t }),
  ],
  ["renderFollowUpEmail", () => renderFollowUpEmail({ ...exampleData.followUpEmail, ...legal, t })],
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

    // Mail clients ignore stylesheets, so `<Tailwind>` has to inline the utilities.
    // Assert the shape, not the design tokens: `justify-center` on the shared body has
    // no react-email default equivalent, so seeing it inline proves the Tailwind pass
    // ran, and re-tuning the chrome's spacing or sizing cannot churn this test.
    expect(html).toContain("justify-content:center");
    expect(html).not.toMatch(/class="[^"]*\bmax-w-[a-z0-9]/);
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
      ...legal,
      t,
    });
    const withoutLegal = await renderVerificationEmail({ ...exampleData.verificationEmail, t });

    expect(withLegal).toContain(legal.imprintUrl);
    expect(withLegal).toContain(legal.privacyUrl);
    expect(withLegal).toContain(legal.imprintAddress);
    // The links need readable labels, not the translation keys behind them.
    expect(withLegal).toContain(">Imprint<");
    expect(withLegal).toContain(">Privacy Policy<");
    expect(withoutLegal).not.toContain(legal.imprintUrl);
    expect(withoutLegal).not.toContain(legal.privacyUrl);
    expect(withoutLegal).not.toContain(legal.imprintAddress);
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
