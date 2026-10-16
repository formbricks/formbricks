import { describe, expect, test } from "vitest";
import { type TNavigatorInfo, getBrowser, getDeviceType } from "@/lib/visit/device";

const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15";
const IPHONE_EDGE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/129.0.2792.84 Mobile/15E148 Safari/605.1.15";
const ANDROID_PHONE_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const ANDROID_TABLET_FIREFOX = "Mozilla/5.0 (Android 14; Tablet; rv:131.0) Gecko/131.0 Firefox/131.0";
const ANDROID_PHONE_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0";
const SAMSUNG_PHONE =
  "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
const WINDOWS_OPERA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0";
const WINDOWS_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";

const navigatorInfo = (
  userAgent: string,
  maxTouchPoints = 0,
  userAgentData?: TNavigatorInfo["userAgentData"]
): TNavigatorInfo => ({ userAgent, maxTouchPoints, userAgentData });

describe("getDeviceType", () => {
  test.each([
    ["desktop Chrome", navigatorInfo(MAC_CHROME, 0, { mobile: false, platform: "macOS" }), "desktop"],
    ["desktop Safari", navigatorInfo(MAC_SAFARI), "desktop"],
    ["an iPad, which reports a Mac user agent", navigatorInfo(MAC_SAFARI, 5), "tablet"],
    ["an iPhone", navigatorInfo(IPHONE_SAFARI, 5), "phone"],
    [
      "an Android phone",
      navigatorInfo(ANDROID_PHONE_CHROME, 5, { mobile: true, platform: "Android" }),
      "phone",
    ],
    [
      "an Android tablet, which reports mobile: false",
      navigatorInfo(ANDROID_TABLET_CHROME, 5, { mobile: false, platform: "Android" }),
      "tablet",
    ],
    ["an Android tablet without client hints", navigatorInfo(ANDROID_TABLET_FIREFOX, 5), "tablet"],
    ["an Android phone without client hints", navigatorInfo(ANDROID_PHONE_FIREFOX, 5), "phone"],
    ["Samsung Internet on a phone", navigatorInfo(SAMSUNG_PHONE, 5), "phone"],
    ["an unknown client", navigatorInfo("curl/8.0"), "desktop"],
  ])("%s → %s", (_, info, expected) => {
    expect(getDeviceType(info)).toBe(expected);
  });
});

describe("getBrowser", () => {
  test.each([
    [MAC_CHROME, "chrome"],
    [MAC_SAFARI, "safari"],
    [IPHONE_SAFARI, "safari"],
    [IPHONE_CHROME, "chrome"],
    [IPHONE_FIREFOX, "firefox"],
    [IPHONE_EDGE, "edge"],
    [WINDOWS_EDGE, "edge"],
    [WINDOWS_OPERA, "opera"],
    [SAMSUNG_PHONE, "samsung"],
    [WINDOWS_FIREFOX, "firefox"],
    ["curl/8.0", "other"],
  ])("%s → %s", (userAgent, expected) => {
    expect(getBrowser(userAgent)).toBe(expected);
  });
});
