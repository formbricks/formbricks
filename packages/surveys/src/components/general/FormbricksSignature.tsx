export default function FormbricksSignature() {
  return (
    <a
      href="https://formbricks.com?utm_source=survey_branding"
      target="_blank"
      className="mb-5 mt-2 flex justify-center">
      <p className="text-xs text-[var(--fb-signature-color)]">
        Powered by{" "}
        <b>
          <span className="text-[var(--fb-signature-color-highlight)] hover:text-[var(--fb-signature-color-highlight-hover)]">
            Formbricks
          </span>
        </b>
      </p>
    </a>
  );
}
