import { describe, expect, test, vi } from "vitest";
import { type TFinishOnLoad, getFinishOnLoadToSend, prepareResponseCreate } from "./finish-on-load";

const screenOut: TFinishOnLoad = { variables: { score: 1 }, endingId: "screened_out" };
const allHidden: TFinishOnLoad = {
  variables: {},
  endingId: "thanks",
  notShown: { blocks: ["b1", "b2"] },
};

describe("getFinishOnLoadToSend", () => {
  test("an all-hidden finish waits for the display, like a screen-out (ENG-6931)", () => {
    expect(
      getFinishOnLoadToSend({ isDisplaySettled: false, alreadyHandled: false, screenOut: null, allHidden })
    ).toBeNull();
    expect(
      getFinishOnLoadToSend({ isDisplaySettled: true, alreadyHandled: false, screenOut: null, allHidden })
    ).toBe(allHidden);
  });

  test("a screen-out waits for the display too, and wins over an all-hidden finish", () => {
    expect(
      getFinishOnLoadToSend({ isDisplaySettled: false, alreadyHandled: false, screenOut, allHidden: null })
    ).toBeNull();
    expect(
      getFinishOnLoadToSend({ isDisplaySettled: true, alreadyHandled: false, screenOut, allHidden })
    ).toBe(screenOut);
  });

  test("sends nothing once handled, or when the survey did not finish on load", () => {
    expect(
      getFinishOnLoadToSend({ isDisplaySettled: true, alreadyHandled: true, screenOut, allHidden })
    ).toBeNull();
    expect(
      getFinishOnLoadToSend({
        isDisplaySettled: true,
        alreadyHandled: false,
        screenOut: null,
        allHidden: null,
      })
    ).toBeNull();
  });
});

describe("prepareResponseCreate", () => {
  test("with spam protection on, fetches a token and hands it to the queue before the create", async () => {
    const setRecaptchaToken = vi.fn();
    const getRecaptchaToken = vi.fn().mockResolvedValue("token-1");

    await expect(
      prepareResponseCreate({
        isSpamProtectionEnabled: true,
        hasResponseId: false,
        getRecaptchaToken,
        setRecaptchaToken,
      })
    ).resolves.toBe(true);
    expect(setRecaptchaToken).toHaveBeenCalledWith("token-1");
  });

  test("refuses the create when no token comes back", async () => {
    const setRecaptchaToken = vi.fn();
    await expect(
      prepareResponseCreate({
        isSpamProtectionEnabled: true,
        hasResponseId: false,
        getRecaptchaToken: vi.fn().mockResolvedValue(null),
        setRecaptchaToken,
      })
    ).resolves.toBe(false);
    expect(setRecaptchaToken).not.toHaveBeenCalled();
  });

  test("needs no token without spam protection, or once the response exists", async () => {
    const getRecaptchaToken = vi.fn();
    await expect(
      prepareResponseCreate({ isSpamProtectionEnabled: false, hasResponseId: false, getRecaptchaToken })
    ).resolves.toBe(true);
    await expect(
      prepareResponseCreate({ isSpamProtectionEnabled: true, hasResponseId: true, getRecaptchaToken })
    ).resolves.toBe(true);
    expect(getRecaptchaToken).not.toHaveBeenCalled();
  });
});
