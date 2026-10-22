/**
 * The product-provided CTA link on the default ending card. Free-plan organizations cannot set
 * external URLs, but this exact link is ours, so the external-URL gate exempts it. The match is
 * exact on purpose: any other path, host or query string is a user-chosen link and stays gated.
 */
export const DEFAULT_ENDING_CARD_BUTTON_LINK =
  "https://formbricks.com?utm_source=formbricks-app&utm_medium=survey&utm_campaign=default_ending_cta";

export const isDefaultEndingCardButtonLink = (link: string | undefined | null): boolean =>
  link === DEFAULT_ENDING_CARD_BUTTON_LINK;
