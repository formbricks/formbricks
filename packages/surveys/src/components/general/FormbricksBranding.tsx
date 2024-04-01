export default function FormbricksBranding() {
  return (
    <a
      href="https://formbricks.com?utm_source=survey_branding"
      target="_blank"
      tabIndex={-1}
      className="mb-5 mt-2 flex justify-center">
      <p className="text-signature text-xs">
        Powered by{" "}
        <b>
          <span className="text-branding-text hover:text-signature">Formbricks</span>
        </b>
      </p>
    </a>
  );
}
