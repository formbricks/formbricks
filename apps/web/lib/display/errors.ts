/**
 * The one message every unusable `displayId` on the client-response create path is rejected with.
 * The public widget routes echo it, so it must not say why the display was refused: a distinct
 * message per reason lets an anonymous caller probe whether a display exists and whom it belongs to
 * (ENG-2240). The reason is logged server-side instead.
 */
export const DISPLAY_REJECTED_MESSAGE = "Display not found";
