import type {
  TDeviceInfo,
  TShowConditionBrowser,
  TShowConditionDeviceType,
} from "@formbricks/types/show-conditions";

/** The parts of `navigator` the classifier reads, so tests can pass plain values. */
export interface TNavigatorInfo {
  userAgent: string;
  maxTouchPoints: number;
  /** Chromium-only (User-Agent Client Hints); absent in Safari and Firefox. */
  userAgentData?: { mobile: boolean; platform: string };
}

const TABLET_UA = /iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobi)/i;
const PHONE_UA = /Mobi|iPhone|iPod|Windows Phone|Android/i;

export const getDeviceType = ({
  userAgent,
  maxTouchPoints,
  userAgentData,
}: TNavigatorInfo): TShowConditionDeviceType => {
  if (userAgentData?.mobile) return "phone";
  // Chrome on an Android tablet reports `mobile: false`, which does not mean desktop.
  if (userAgentData?.platform === "Android") return "tablet";
  // iPadOS asks for desktop sites, so its user agent says "Macintosh"; only the touch screen gives it away.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "tablet";
  if (TABLET_UA.test(userAgent)) return "tablet";
  if (PHONE_UA.test(userAgent)) return "phone";
  return "desktop";
};

// Order matters: Edge, Opera and Samsung Internet also say "Chrome", and Chrome also says "Safari".
const BROWSER_PATTERNS: [TShowConditionBrowser, RegExp][] = [
  ["edge", /Edg(e|A|iOS)?\//],
  ["opera", /OPR\/|OPiOS\//],
  ["samsung", /SamsungBrowser\//],
  ["firefox", /Firefox\/|FxiOS\//],
  ["chrome", /Chrome\/|CriOS\//],
  ["safari", /Safari\//],
];

export const getBrowser = (userAgent: string): TShowConditionBrowser =>
  BROWSER_PATTERNS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? "other";

const readNavigator = (): TNavigatorInfo => ({
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
  userAgentData: (navigator as Navigator & Pick<TNavigatorInfo, "userAgentData">).userAgentData,
});

let cachedDevice: { deviceType: TShowConditionDeviceType; browser: TShowConditionBrowser } | undefined;

/**
 * Device type and browser cannot change during a page, so they are read once. The window width can
 * (a phone rotates), so it is read every time.
 */
export const getDeviceInfo = (): TDeviceInfo => {
  if (!cachedDevice) {
    const info = readNavigator();
    cachedDevice = { deviceType: getDeviceType(info), browser: getBrowser(info.userAgent) };
  }
  return { ...cachedDevice, screenWidth: window.innerWidth };
};

export const resetDeviceCache = (): void => {
  cachedDevice = undefined;
};
