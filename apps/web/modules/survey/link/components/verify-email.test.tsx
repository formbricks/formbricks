import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { VerifyEmail } from "./verify-email";

const mocks = vi.hoisted(() => {
  const refresh = vi.fn();
  return { sendLinkSurveyVerificationEmail: vi.fn(), toastError: vi.fn(), refresh, router: { refresh } };
});

vi.mock("@/modules/survey/link/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/link/lib/api-client")>()),
  sendLinkSurveyVerificationEmail: mocks.sendLinkSurveyVerificationEmail,
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("react-hot-toast", () => ({ Toaster: () => null, toast: { error: mocks.toastError } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/modules/survey/link/hooks/use-app-locale", () => ({ useAppLocale: () => true }));
vi.mock("@/lib/utils/recall", () => ({ replaceHeadlineRecall: (survey: unknown) => survey }));
vi.mock("@/modules/survey/lib/client-utils", () => ({ getElementsFromBlocks: () => [] }));

const surveyId = "clsurvey00000000000000000";

const renderVerifyEmail = () =>
  render(
    <VerifyEmail
      survey={{ id: surveyId, blocks: [], styling: null } as never}
      singleUseId="invitee-1"
      singleUseToken="token"
      languageCode="de-DE"
      styling={{} as never}
      locale="en-US"
    />
  );

const submit = (email = "Respondent@Example.com") => {
  fireEvent.change(screen.getByPlaceholderText("engineering@acme.com"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "s.verify_email_before_submission_button" }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("VerifyEmail", () => {
  test("sends the lowercased address with the link and language, then says the email is on its way", async () => {
    mocks.sendLinkSurveyVerificationEmail.mockResolvedValue(undefined);
    renderVerifyEmail();

    submit();

    expect(await screen.findByText("s.check_inbox_or_spam")).toBeInTheDocument();
    expect(mocks.sendLinkSurveyVerificationEmail).toHaveBeenCalledWith({
      surveyId,
      email: "respondent@example.com",
      suId: "invitee-1",
      suToken: "token",
      locale: "en-US",
      surveyLanguageCode: "de-DE",
    });
  });

  test("shows a refusal's own message", async () => {
    mocks.sendLinkSurveyVerificationEmail.mockRejectedValue(
      new V3ApiError({ status: 429, detail: "Maximum number of requests reached. Please try again later." })
    );
    renderVerifyEmail();

    submit();

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Maximum number of requests reached. Please try again later."
      )
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("falls back to a translated message when the request never got an answer", async () => {
    mocks.sendLinkSurveyVerificationEmail.mockRejectedValue(new V3ApiError({ status: 0, detail: "" }));
    renderVerifyEmail();

    submit();

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("common.something_went_wrong_please_try_again")
    );
  });

  test("re-renders the page instead of a toast when the survey stopped taking responses", async () => {
    mocks.sendLinkSurveyVerificationEmail.mockRejectedValue(
      new V3ApiError({ status: 404, detail: "Survey not found" })
    );
    renderVerifyEmail();

    submit();

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
