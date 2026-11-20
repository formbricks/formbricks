/**
 * A `DANGEROUSLY_*` switch for self-hosted operators (internal webhook URLs, plain-HTTP workflows):
 * on only when set to "1" outside Formbricks Cloud. The Cloud guard is hard, so a stray variable in a
 * Cloud deployment can never open an SSRF path or drop HTTPS (ENG-7167, ENG-7168).
 */
export const isSelfHostedSwitchOn = (value: string | undefined, { isCloud }: { isCloud: boolean }): boolean =>
  !isCloud && value === "1";
