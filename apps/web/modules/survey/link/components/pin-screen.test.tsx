import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { PinScreen } from "./pin-screen";

// One router for every render, as Next gives: the PIN check re-runs whenever its effect's inputs change.
const mocks = vi.hoisted(() => {
  const refresh = vi.fn();
  return { verifyLinkSurveyPin: vi.fn(), refresh, router: { refresh } };
});

vi.mock("@/modules/survey/link/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/link/lib/api-client")>()),
  verifyLinkSurveyPin: mocks.verifyLinkSurveyPin,
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/modules/survey/link/hooks/use-app-locale", () => ({ useAppLocale: () => true }));
vi.mock("@/modules/survey/link/components/survey-client-wrapper", () => ({
  SurveyClientWrapper: ({
    survey,
    pinAuthToken,
  }: Readonly<{ survey: { id: string }; pinAuthToken?: string }>) => (
    <div data-testid="survey">{`${survey.id}:${pinAuthToken ?? "none"}`}</div>
  ),
}));
vi.mock("@/modules/ui/components/otp-input", () => ({
  OTPInput: ({
    value,
    onChange,
    disabled,
  }: Readonly<{
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
  }>) => (
    <input aria-label="pin" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const surveyId = "clsurvey00000000000000000";

const renderPinScreen = () =>
  render(
    <PinScreen
      surveyId={surveyId}
      suId="invitee-1"
      suToken="token"
      workspace={{ styling: {}, logo: null, linkSurveyBranding: true, customHeadScripts: null } as never}
      publicDomain="https://surveys.example.com"
      IS_FORMBRICKS_CLOUD={false}
      languageCode="default"
      locale="en-US"
      isEmbed={false}
      isPreview={false}
      styling={{} as never}
    />
  );

const typePin = (pin: string) => fireEvent.change(screen.getByLabelText("pin"), { target: { value: pin } });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("PinScreen", () => {
  test("checks a four-digit PIN with the link it was opened with and opens the survey", async () => {
    mocks.verifyLinkSurveyPin.mockResolvedValue({ survey: { id: surveyId }, pinAuthToken: "pin-token" });
    renderPinScreen();

    typePin("1234");

    expect(await screen.findByTestId("survey")).toHaveTextContent(`${surveyId}:pin-token`);
    expect(mocks.verifyLinkSurveyPin).toHaveBeenCalledWith({
      surveyId,
      pin: "1234",
      suId: "invitee-1",
      suToken: "token",
    });
  });

  test("does not check a PIN until it has four digits", () => {
    renderPinScreen();

    typePin("123");

    expect(mocks.verifyLinkSurveyPin).not.toHaveBeenCalled();
  });

  test("keeps the gate after a wrong PIN, without re-rendering the page", async () => {
    mocks.verifyLinkSurveyPin.mockRejectedValue(new V3ApiError({ status: 422, detail: "INVALID_PIN" }));
    renderPinScreen();

    typePin("0000");

    await waitFor(() => expect(mocks.verifyLinkSurveyPin).toHaveBeenCalled());
    expect(screen.queryByTestId("survey")).toBeNull();
    expect(screen.getByText("s.enter_pin")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("re-renders the page when the survey stopped taking responses after it loaded", async () => {
    mocks.verifyLinkSurveyPin.mockRejectedValue(new V3ApiError({ status: 404, detail: "Survey not found" }));
    renderPinScreen();

    typePin("1234");

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("survey")).toBeNull();
  });
});
