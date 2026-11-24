/**
 * The Content-Security-Policy for every page the app renders, built per request in `proxy.ts`.
 *
 * Scripts and `<style>` elements run only when they carry the request's nonce: Next adds it to its own
 * scripts and styles when the request's CSP header names one, and our code reads it through
 * `lib/csp/nonce.tsx`. `'strict-dynamic'` lets a trusted script load others (chunks, reCAPTCHA,
 * Turnstile, Stripe, Plain), so no host list is needed for scripts and none is allowed to grow.
 *
 * `style="…"` attributes stay allowed through `style-src-attr`: React renders style props into the
 * server HTML (next/image does on every image), and a nonce cannot cover an attribute. Elements, the
 * vector injected CSS needs, are covered by `style-src`.
 *
 * No directive allows a whole scheme (`https:`) except on routes that show content survey authors
 * point at any host: survey images on the survey pages and in the app, and on the public survey pages
 * the frames (a Cal.com host the author sets) and requests (the survey's custom head scripts) too.
 */

export const CSP_HEADER = "Content-Security-Policy";
/** Request header carrying the nonce from `proxy.ts` to server components. */
export const CSP_NONCE_HEADER = "x-nonce";

/** 128 bits from the platform CSPRNG, base64-encoded as CSP nonces are. */
export const createCspNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCodePoint(...bytes));
};

export type TFrameAncestors = "'self'" | "'none'" | "*";

/**
 * What a route shows decides how far its policy reaches:
 * - `app`: pages with no survey content (auth, setup, invites, settings).
 * - `workspace`: workspace pages, which render survey content (editor preview, summaries, responses)
 *   whose images can sit on any host.
 * - `survey`: the public survey pages, which also run the survey's custom head scripts and embed a
 *   Cal.com host the author chooses.
 */
export type TCspRouteProfile = "app" | "workspace" | "survey";

export interface TCspRoute {
  profile: TCspRouteProfile;
  frameAncestors: TFrameAncestors;
}

// Link surveys (/s) and contact survey links (/c). Pretty URLs (/p) only redirect to /s.
const SURVEY_PATH = /^\/[sc](?:\/|$)/;
const WORKSPACE_PATH = /^\/workspaces(?:\/|$)/;
const SSO_RECOVERY_PATH = /^\/sso-recovery(?:\/|$)/;

/**
 * Surveys (/s, /c) are embedded on customer sites, so any site may frame them. The SSO recovery
 * confirmation is a one-click account change, so nothing may frame it (ENG-7395). Everything else
 * only its own origin.
 */
export const getCspRoute = (pathname: string): TCspRoute => {
  if (SURVEY_PATH.test(pathname)) {
    return { profile: "survey", frameAncestors: "*" };
  }
  if (SSO_RECOVERY_PATH.test(pathname)) return { profile: "app", frameAncestors: "'none'" };
  if (WORKSPACE_PATH.test(pathname)) return { profile: "workspace", frameAncestors: "'self'" };
  return { profile: "app", frameAncestors: "'self'" };
};

/** Hosts the browser talks to that depend on how the instance is configured. */
export interface TCspHosts {
  /**
   * Origins of the app itself other than the request's own (WEBAPP_URL, PUBLIC_URL), and of the
   * Formbricks instance whose SDK the app runs.
   */
  appOrigins: string[];
  /** Where the browser POSTs presigned uploads (the S3 endpoint or AWS bucket). */
  storageOrigins: string[];
  /** The Sentry DSN's ingest origin. */
  sentryOrigins: string[];
  /** Loopback origins, allowed only in development and E2E builds. */
  loopbackOrigins: string[];
}

// Hosts every deployment may need, fixed by the providers. Scripts are not listed: 'strict-dynamic'
// lets the integration's loader (created by our own code) bring them in.
const IMAGE_HOSTS = [
  // OAuth profile avatars and the editor's Unsplash picker (lib/optimizable-image-hosts.mjs)
  "https://avatars.githubusercontent.com",
  "https://avatars.slack-edge.com",
  "https://lh3.googleusercontent.com",
  "https://images.unsplash.com",
];
const VIDEO_FRAME_HOSTS = ["https://www.youtube.com", "https://player.vimeo.com", "https://www.loom.com"];
const CAL_FRAME_HOSTS = ["https://cal.com", "https://app.cal.com"];
const RECAPTCHA_FRAME_HOSTS = ["https://www.google.com", "https://recaptcha.google.com"];
const TURNSTILE_HOST = "https://challenges.cloudflare.com";
const STRIPE_FRAME_HOSTS = ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com"];
const STRIPE_CONNECT_HOSTS = ["https://api.stripe.com"];
// Plain support chat (Formbricks Cloud): https://www.plain.com/docs/chat, "Content Security Policy"
const PLAIN_CONNECT_HOSTS = [
  "https://chat.uk.plain.com",
  "https://prod-uk-services-attachm-attachmentsuploadbucket2-1l2e4906o2asm.s3.eu-west-2.amazonaws.com",
];
const PLAIN_IMAGE_HOSTS = [
  "https://prod-uk-services-workspac-workspacefilespublicbuck-vs4gjqpqjkh6.s3.amazonaws.com",
  "https://prod-uk-services-attachm-attachmentsbucket28b3ccf-uwfssb4vt2us.s3.eu-west-2.amazonaws.com",
  "https://i0.wp.com",
];
const PLAIN_FRAME_HOSTS = ["https://chat.cdn-plain.com"];
const PLAIN_STYLE_HOSTS = ["https://fonts.googleapis.com"];
const PLAIN_FONT_HOSTS = ["https://fonts.gstatic.com"];

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const directive = (name: string, sources: string[]): string => `${name} ${unique(sources).join(" ")}`;

export interface TBuildCspInput {
  nonce: string;
  route: TCspRoute;
  hosts: TCspHosts;
  /** `next dev`: React needs `eval` for its error overlay, and HMR injects styles without a nonce. */
  isDevelopment: boolean;
}

export const buildContentSecurityPolicy = ({
  nonce,
  route,
  hosts,
  isDevelopment,
}: TBuildCspInput): string => {
  const { appOrigins, storageOrigins, sentryOrigins, loopbackOrigins } = hosts;
  const isSurvey = route.profile === "survey";
  const showsSurveyContent = route.profile !== "app";

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDevelopment) scriptSources.push("'unsafe-eval'");

  // A nonce makes browsers ignore 'unsafe-inline', so development lists only the latter.
  const styleSources = ["'self'", ...appOrigins, ...PLAIN_STYLE_HOSTS];
  styleSources.push(isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`);

  const imageSources = [
    "'self'",
    "blob:",
    "data:",
    ...appOrigins,
    ...storageOrigins,
    ...loopbackOrigins,
    ...IMAGE_HOSTS,
    ...PLAIN_IMAGE_HOSTS,
  ];
  // Survey images, logos and backgrounds are URLs the author or the API may point anywhere.
  if (showsSurveyContent) imageSources.push("https:");

  const connectSources = [
    "'self'",
    ...appOrigins,
    ...storageOrigins,
    ...sentryOrigins,
    ...loopbackOrigins,
    TURNSTILE_HOST,
    ...STRIPE_CONNECT_HOSTS,
    ...PLAIN_CONNECT_HOSTS,
  ];
  // The survey's custom head scripts (analytics tags) send to hosts the survey owner chooses.
  if (isSurvey) connectSources.push("https:");

  const frameSources = [
    "'self'",
    ...appOrigins,
    ...VIDEO_FRAME_HOSTS,
    ...CAL_FRAME_HOSTS,
    ...RECAPTCHA_FRAME_HOSTS,
    TURNSTILE_HOST,
    ...STRIPE_FRAME_HOSTS,
    ...PLAIN_FRAME_HOSTS,
  ];
  // A Cal.com question embeds the booking host its author set, which can be a self-hosted Cal.
  if (isSurvey) frameSources.push("https:");

  return [
    "default-src 'self'",
    directive("script-src", scriptSources),
    // `worker-src` must stay explicit: without it browsers fall back to `script-src`, and the `blob:`
    // worker Sentry Session Replay compresses recordings in is blocked (ENG-3194).
    "worker-src 'self' blob:",
    directive("style-src", styleSources),
    "style-src-attr 'unsafe-inline'",
    directive("img-src", imageSources),
    directive("font-src", ["'self'", "data:", ...appOrigins, ...PLAIN_FONT_HOSTS]),
    directive("connect-src", connectSources),
    directive("frame-src", frameSources),
    directive("media-src", ["'self'", "blob:", ...appOrigins, ...storageOrigins, ...loopbackOrigins]),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${route.frameAncestors}`,
  ].join("; ");
};
