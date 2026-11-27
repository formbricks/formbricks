/**
 * Bounds for the optional `SETUP_TOKEN` (ENG-7313).
 *
 * The minimum is enforced when the operator sets the environment variable; the maximum is shared with
 * the sign-up request schema so a configured token can always be presented through the setup form.
 */
export const SETUP_TOKEN_MIN_LENGTH = 16;
export const SETUP_TOKEN_MAX_LENGTH = 512;

/** Primary key of the singleton `InstanceSetup` row that records the instance has been set up (ENG-7313). */
export const INSTANCE_SETUP_ID = "instance";
