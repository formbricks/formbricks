export default function FormbricksSignature() {
  return (
    <a
      href="https://formbricks.com?utm_source=survey_branding"
      target="_blank"
      tabIndex={-1}
      className="mb-5 mt-2 flex justify-center">
      <p className="text-xs text-[--fb-identifier-text-color]">
        Powered by{" "}
        <b>
          <span className="text-[--fb-info-text-color] hover:text-[--fb-heading-color]">Formbricks</span>
        </b>
      </p>
    </a>
  );
}
