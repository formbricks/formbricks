export function FormbricksBranding() {
  return (
    <a
      href="https://formbricks.com?utm_source=survey_branding"
      target="_blank"
      tabIndex={-1}
      className="my-2 flex justify-center"
      rel="noopener">
      <p className="text-signature text-xs">
        Powered by{" "}
        <b>
          <span className="text-branding-text hover:text-signature">Formbricks</span>
        </b>
      </p>
    </a>
  );
}
